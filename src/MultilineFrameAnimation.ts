import Base from 'utils/Base';
import { BaseConfig, MultilineDrawType, OriType } from 'utils/types';
import { isHTMLElement } from './utils';

/**
 * @param {number} totalFrameNumber 总帧数（序列图总数）
 * @param {number} columnNumber 帧图片列数
 * @param {number} fps 1s内帧数 默认60帧
 * @param {boolean} infinite  无限播放
 * @param {number} delayFrame  延迟帧数
 * @param {'none'|'forwards'|'backwards'|'both'} fillMode 动画结束后状态
 * @param {"normal"|"alternate"} motionDirection 是否应该轮流反向播放动画
 */
export interface MultilineConfig extends BaseConfig {
  columnNumber: number;
}

class MultilineFrameAnimation extends Base {
  public config: Required<MultilineConfig> = {
    totalFrameNumber: 0,
    columnNumber: 0,
    fps: 60,
    infinite: false,
    delayFrame: 0,
    fillMode: 'none',
    motionDirection: 'normal'
  };
  protected drawType?: MultilineDrawType;

  constructor(ele: HTMLElement|null|undefined, config?: MultilineConfig, drawType?: MultilineDrawType) {
    super(ele);
    if(drawType === 'transform' && !isHTMLElement(ele)) {
      console.warn(`Please Check your element parameter, which should be a <HTMLElement>`);
    }
    this.config = {...this.config, ...config};
    this.drawType = drawType || 'background';
  }

  /**
   * 一帧跨越的百分比
   * backgroundPosition与transfrom不太一致，特殊处理。
   **/
  protected _calcOneFramePercent () {
    let columns = this.config.columnNumber;
    let rows = Math.ceil(this.config.totalFrameNumber / this.config.columnNumber);
    if(this.drawType === 'background') {
      columns -= 1;
      rows -= 1;
    }
    return {
      rowPercent: 1 / rows * 100,
      columnPercent: 1 / columns * 100
    };
  }

  /**
   * 计算当前在第几张画面
   * 超过totalFrameNumber时，则继续从0开始开始计算。
   **/
  protected _calcCurrentFrame (type: OriType) {
    let tolerenceCurrentFrame = Math.abs(this.currentFrame) % this.config.totalFrameNumber;
    if(this.currentFrame < 0 && (this.config.fillMode === 'backwards' || this.config.fillMode === 'both')) {
      tolerenceCurrentFrame = 0;
    }
    if(type === 'rtl') {
      tolerenceCurrentFrame = this.config.totalFrameNumber - tolerenceCurrentFrame - 1;
    }
    return {
      current: tolerenceCurrentFrame,
      currentRow: Math.floor(tolerenceCurrentFrame / this.config.columnNumber),
      currentColumn: tolerenceCurrentFrame % this.config.columnNumber,
    };
  }

  /** 移动backgroundPosition跳到下一帧 */
  protected _drawBackground(type: OriType) {
    if (!isHTMLElement(this.element)) {
      return;
    }
    const { currentRow, currentColumn } = this._calcCurrentFrame(type);
    const { rowPercent, columnPercent } = this._calcOneFramePercent();
    this.element!.style.backgroundPosition = `${currentColumn * columnPercent}% ${currentRow * rowPercent}%`;
  }

  /** 移动transform跳到下一帧 */
  protected _drawTransform(type: OriType) {
    if (!isHTMLElement(this.element)) {
      return;
    }
    const { currentRow, currentColumn } = this._calcCurrentFrame(type);
    const { rowPercent, columnPercent } = this._calcOneFramePercent();
    this.element!.style.transform = `translate(-${currentColumn * columnPercent}%, -${currentRow * rowPercent}%)`;
  }

  renderFrame(currentFrame: number, type: OriType) {
    /** 单独调用时，可跳跃至某一帧 */
    this.currentFrame = currentFrame;
    if(this.drawType === 'transform') {
      this._drawTransform(type);
    } else {
      this._drawBackground(type);
    }
  }

  protected clearStyle() {
    if (this.element) {
      if(this.drawType === 'transform') {
        this.element.style.transform = '';
      } else {
        this.element.style.backgroundPosition = '';
      }
    }
  }
}

export default MultilineFrameAnimation;
