import Base from 'utils/Base';
import { BaseConfig, OriType, SinglelineDrawType } from 'utils/types';
import { isHTMLElement, isRenderImageElement, IRenderImageElement } from './utils';

/**
 * @param {number} totalFrameNumber 总帧数（序列图总数）
 * @param {"vertical"|"horizontal"} imageDirection 帧图片排列方式 默认"vertical"
 * @param {number} fps 1s内帧数 默认60帧
 * @param {boolean} infinite  无限播放
 * @param {number} delayFrame  延迟帧数
 * @param {'none'|'forwards'|'backwards'|'both'} fillMode 动画结束后状态
 * @param {string[]} imgSrcList 替换图片刷新动画帧使用的src数组
 * @param {boolean} prefetch 是否预加载 imgSrcList
 * @param {"normal"|"alternate"} motionDirection 是否应该轮流反向播放动画
 */
export interface SinglelineConfig extends BaseConfig {
  /** @defaultValue "vertical" */
  imageDirection?: 'vertical' | 'horizontal';
  imgSrcList?: string[];
  prefetch?: boolean;
}

class SinglelineFrameAnimation extends Base {
  public config: Required<SinglelineConfig> = {
    totalFrameNumber: 0,
    imageDirection: 'vertical',
    fps: 60,
    infinite: false,
    delayFrame: 0,
    fillMode: 'none',
    imgSrcList: [],
    prefetch: false,
    motionDirection: 'normal'
  };
  protected drawType?: SinglelineDrawType;
  /** hooks */
  public onprefetch?: (result: boolean[], self: SinglelineFrameAnimation) => void;

  constructor(ele: HTMLElement|null|undefined, config?: SinglelineConfig, drawType?: SinglelineDrawType) {
    super(ele);
    if(!isHTMLElement(ele)) {
      console.warn(`Please Check your element parameter, which should be a <HTMLElement>`);
    }
    if(drawType === 'imgSrc' && !isRenderImageElement(ele)) {
      console.warn("Element should be <img> when draw type is imgSrc");
    }
    this.config = {...this.config, ...config};
    this.drawType = drawType;
    this.prefetchImageSource();
  }

  /** 预加载 */
  async prefetchImageSource() {
    if(this.config.prefetch && this.config?.imgSrcList.length) {
      const result = await Promise.all(this.config.imgSrcList.map(src => new Promise<boolean>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => reject(false);
        img.onabort = () => reject(false);
        img.src = src;
      })))
      this.onprefetch?.(result, this)
    }
  }

  /**
   * 一帧跨越的百分比
   * backgroundPosition与transfrom不太一致，特殊处理。
   **/
  protected _calcOneFramePercent () {
    return 1 / (this.config.totalFrameNumber - (this.drawType === 'transform' ? 0 : 1)) * 100;
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
    return tolerenceCurrentFrame;
  }

  /** 移动backgroundPosition跳到下一帧 */
  protected _drawBackground(type: OriType) {
    if (!isHTMLElement(this.element)) {
      return;
    }
    let current = this._calcCurrentFrame(type);
    const framePercent = this._calcOneFramePercent();
    if (this.config.imageDirection === 'horizontal') {
      this.element!.style.backgroundPosition = `${current * framePercent}% 0`;
    } else {
      this.element!.style.backgroundPosition = `0 ${current * framePercent}%`;
    }
  }

  /** 移动transform跳到下一帧 */
  protected _drawTransform(type: OriType) {
    if (!isHTMLElement(this.element)) {
      return;
    }
    const current = this._calcCurrentFrame(type);
    const framePercent = this._calcOneFramePercent();
    if (this.config.imageDirection === 'horizontal') {
      this.element!.style.transform = `translate(-${current * framePercent}%, 0)`;
    } else {
      this.element!.style.transform = `translate(0, -${current * framePercent}%)`;
    }
  }

  /** 移动transform跳到下一帧 */
  protected _drawOffset(type: OriType) {
    if (!isHTMLElement(this.element)) {
      return;
    }
    const current = this._calcCurrentFrame(type);
    if (this.config.imageDirection === 'horizontal') {
      this.element!.style.left = `-${current * 100}%`;
    } else {
      this.element!.style.top = `-${current * 100}%`;
    }
  }

  /** 更新src跳到下一帧 */
  protected _drawImageSource(type: OriType) {
    if (!isRenderImageElement(this.element)) {
      return;
    }
    const current = this._calcCurrentFrame(type);
    (this.element as IRenderImageElement).src = this.config.imgSrcList[current];
  }

  renderFrame(currentFrame: number, type: OriType) {
    /** 单独调用时，可跳跃至某一帧 */
    this.currentFrame = currentFrame;
    if(this.drawType === 'transform') {
      this._drawTransform(type);
    } if(this.drawType === 'offset') {
      this._drawOffset(type);
    } else if(this.drawType === 'imgSrc') {
      this._drawImageSource(type);
    } else {
      this._drawBackground(type);
    }
  }

  protected clearStyle () {
    if (this.element) {
      if (this.drawType === 'transform') {
        this.element.style.transform = '';
      } else if (this.drawType === 'offset') {
        this.element.style.top = '';
        this.element.style.left = '';
      } else if (this.drawType === 'imgSrc') {
        (this.element as IRenderImageElement).src = this.config.imgSrcList[this.currentFrame];
      } else {
        this.element.style.backgroundPosition = '';
      }
    }
  };
}

export default SinglelineFrameAnimation;
