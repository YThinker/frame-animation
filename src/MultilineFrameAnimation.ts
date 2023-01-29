import raf from 'raf';
import { isHTMLElement, isRenderImageElement, IRenderImageElement } from './utils';

type IFillMode = 'none'|'forwards'|'backwards'|'both'
type OriType = 'ltr'|'rtl'
type IDrawType = 'background'|'transform'

/**
 * @param {number} totalFrameNumber 总帧数（序列图总数）
 * @param {number} columnNumber 帧图片列数
 * @param {number} fps 1s内帧数 默认60帧
 * @param {boolean} infinite  无限播放
 * @param {number} delayFrame  延迟帧数
 * @param {'none'|'forwards'|'backwards'|'both'} fillMode 动画结束后状态
 * @param {"normal"|"alternate"} motionDirection 是否应该轮流反向播放动画
 */
interface IConfig {
  totalFrameNumber: number;
  columnNumber: number;
  /** @defaultValue 60 */
  fps?: number;
  infinite?: boolean;
  delayFrame?: number;
  fillMode?: IFillMode;
  motionDirection?: "normal" | "alternate";
}

class MultilineFrameAnimation {
  public config: Required<IConfig> = {
    totalFrameNumber: 0,
    columnNumber: 0,
    fps: 60,
    infinite: false,
    delayFrame: 0,
    fillMode: 'none',
    motionDirection: 'normal'
  };
  public element;
  private drawType?: IDrawType;
  /** 当前在第几帧 */
  public currentFrame = 0;
  /** 上一次绘制时间 */
  public lastStartTimestamp = 0;
  /** hooks */
  public onstart = () => void 0;
  public onupdate = (startTimestamp: DOMHighResTimeStamp) => void 0;
  public oncomplete = (startTimestamp: DOMHighResTimeStamp) => void 0;
  /** side effect */
  public rafSymbol: number|null = null;

  constructor(ele: HTMLElement|null|undefined, config?: IConfig, drawType?: IDrawType) {
    if(drawType === 'transform' && !isHTMLElement(ele)) {
      console.warn("Element should be <picture> or <img> when draw type is transform");
    }
    this.element = ele;
    this.drawType = drawType || 'background';
    this.config = {...this.config, ...config};
  }

  /** 动画执行预设多久 */
  private _calcFrameInterval () {
    /** 一帧时间间隔 */
    return 1000 / (typeof this.config.fps === 'number' ? this.config.fps : 60)
  }

  /**
   * 一帧跨越的百分比
   * backgroundPosition与transfrom不太一致，特殊处理。
   **/
  private _calcOneFramePercent () {
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
  private _calcCurrentFrame (type: OriType) {
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
  private _drawBackground(type: OriType) {
    if (!isHTMLElement(this.element)) {
      return;
    }
    const { currentRow, currentColumn } = this._calcCurrentFrame(type);
    const { rowPercent, columnPercent } = this._calcOneFramePercent();
    this.element!.style.backgroundPosition = `${currentColumn * columnPercent}% ${currentRow * rowPercent}%`;
  }

  /** 移动transform跳到下一帧 */
  private _drawTransform(type: OriType) {
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

  /**
   * 绘制
   * @param {boolean} once 下一帧动画执行完成后终止（特殊用途）
   **/
  private draw (type: OriType = 'ltr', startTimestamp: DOMHighResTimeStamp, once?: boolean) {
    const cacheRafSymbol = this.rafSymbol;
    /** 获取当前时间与lastStartTimestamp对比 超过一帧间隔则绘制下一帧 */
    if (this.lastStartTimestamp === 0 || startTimestamp - this.lastStartTimestamp >= this._calcFrameInterval()) {
      this.lastStartTimestamp = startTimestamp;

      this.renderFrame(this.currentFrame, type);
      this.onupdate(startTimestamp)
      if(once) {
        return;
      }

      // 判断是否终止绘制，或已绘制到最后一张
      if (this.currentFrame + (this.config.infinite ? 0 : 1) === this.config.totalFrameNumber) {
        this.oncomplete(startTimestamp);
        // 交替播放
        if(this.config.motionDirection === 'alternate') {
          this.currentFrame = 0;
          this.continue(type === 'ltr' ? 'rtl' : 'ltr');
          return;
        }
        // 无限循环
        if (this.config.infinite) {
          this.start(type);
          return;
        }
        // 不维持最后一步状态时，触发一次渲染回到第一次
        if(this.config.fillMode !== 'both' && this.config.fillMode !== 'forwards' && cacheRafSymbol === this.rafSymbol) {
          this.currentFrame += 1;
          this._setRaf(type, cacheRafSymbol, true);
        }
        return;
      } else {
        this.currentFrame += 1;
      }
    }
    // 继续绘制
    this._setRaf(type, cacheRafSymbol, once);
  };

  /**
   * 设置定时器
   * 当传入的cacheRafSymbol存在且和当前rafSymbol不同时，说明用户已经手动设置了一次新的定时器，不再继续设置定时器。
   */
  private _setRaf(type: OriType, cacheRafSymbol?: number|null, once?: boolean) {
    if(cacheRafSymbol && this.rafSymbol !== cacheRafSymbol) {
      return;
    }
    this.rafSymbol = raf((currentStartTimestamp) =>
      this.draw(type, currentStartTimestamp, once),
    );
  }

  /** 启动 */
  start(type?: OriType) {
    this.currentFrame = 0 - this.config.delayFrame;
    this.lastStartTimestamp = 0;
    // 清除上一次绘制
    typeof this.rafSymbol === 'number' && raf.cancel(this.rafSymbol);
    // 开始绘制
    this._setRaf(type ?? 'ltr');
    this.onstart();
  }

  /** 从中断位置继续 */
  continue(type?: OriType) {
    // 清除上一次绘制
    typeof this.rafSymbol === 'number' && raf.cancel(this.rafSymbol);
    // 开始绘制
    this._setRaf(type ?? 'ltr');
  }

  /** 中断 */
  interrupt() {
    typeof this.rafSymbol === 'number' && raf.cancel(this.rafSymbol);
    this.rafSymbol = null;
  }

  /** 终止 */
  cancel() {
    typeof this.rafSymbol === 'number' && raf.cancel(this.rafSymbol);
    this.rafSymbol = null;
    this.currentFrame = 0;
    this.lastStartTimestamp = 0;
  }
}

export default MultilineFrameAnimation;
