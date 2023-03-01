import raf from 'raf';
import { isHTMLElement, isRenderImageElement, IRenderImageElement } from './utils';

export type IFillMode = 'none'|'forwards'|'backwards'|'both'
export type OriType = 'ltr'|'rtl'
export type IDrawType = 'background'|'transform'|'imgSrc'

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
export interface IConfig {
  totalFrameNumber: number;
  /** @defaultValue "vertical" */
  imageDirection?: 'vertical' | 'horizontal';
  /** @defaultValue 60 */
  fps?: number;
  infinite?: boolean;
  delayFrame?: number;
  fillMode?: IFillMode;
  imgSrcList?: string[];
  prefetch?: boolean;
  motionDirection?: "normal" | "alternate";
}

class SinglelineFrameAnimation {
  public config: Required<IConfig> = {
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
  public element;
  protected drawType?: IDrawType;
  /** 当前在第几帧 */
  public currentFrame = 0;
  /** 上一次绘制时间 */
  public lastStartTimestamp = 0;
  /** hooks */
  public onstart?: (self: SinglelineFrameAnimation) => void;
  public onprefetch?: (result: boolean[], self: SinglelineFrameAnimation) => void;
  public onupdate?: (startTimestamp: DOMHighResTimeStamp, self: SinglelineFrameAnimation) => void;
  public oncomplete?: (startTimestamp: DOMHighResTimeStamp, self: SinglelineFrameAnimation) => void;
  public oncancel?: (self: SinglelineFrameAnimation) => void;
  /** side effect */
  public rafSymbol: number|null = null;

  constructor(ele: HTMLElement|null|undefined, config?: IConfig, drawType?: IDrawType) {
    if(drawType === 'transform' && !isHTMLElement(ele)) {
      console.warn(`Please Check your element parameter, which should be a <HTMLElement>`);
    }
    if(drawType === 'imgSrc' && !isRenderImageElement(ele)) {
      console.warn("Element should be <img> when draw type is transform");
    }
    this.element = ele;
    this.drawType = drawType;
    this.config = {...this.config, ...config};
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

  /** 动画执行预设多久 */
  protected _calcFrameInterval () {
    /** 一帧时间间隔 */
    return 1000 / (typeof this.config.fps === 'number' ? this.config.fps : 60)
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
    } else if(this.drawType === 'imgSrc') {
      this._drawImageSource(type);
    } else {
      this._drawBackground(type);
    }
  }

  /**
   * 绘制
   * @param {boolean} once 下一帧动画执行完成后终止（特殊用途）
   **/
  protected draw (type: OriType = 'ltr', startTimestamp: DOMHighResTimeStamp, once?: boolean) {
    const cacheRafSymbol = this.rafSymbol;
    /** 获取当前时间与lastStartTimestamp对比 超过一帧间隔则绘制下一帧 */
    if (this.lastStartTimestamp === 0 || startTimestamp - this.lastStartTimestamp >= this._calcFrameInterval()) {
      this.lastStartTimestamp = startTimestamp;

      this.renderFrame(this.currentFrame, type);
      this.onupdate?.(startTimestamp, this)
      if(once) {
        return;
      }

      // 判断是否终止绘制，或已绘制到最后一张
      if (this.currentFrame + (this.config.infinite ? 0 : 1) === this.config.totalFrameNumber) {
        this.oncomplete?.(startTimestamp, this);
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
  protected _setRaf(type: OriType, cacheRafSymbol?: number|null, once?: boolean) {
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
    this.onstart?.(this);
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
    /** clear inject style */
    if (this.element) {
      if (this.drawType === 'transform') {
        this.element.style.transform = '';
      } else if (this.drawType === 'imgSrc') {
        (this.element as IRenderImageElement).src = this.config.imgSrcList[this.currentFrame];
      } else {
        this.element.style.backgroundPosition = '';
      }
    }
    this.oncancel?.(this);
  }
}

export default SinglelineFrameAnimation;
