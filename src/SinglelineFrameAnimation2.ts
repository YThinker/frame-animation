import raf from 'raf';
import { isHTMLElement, isRenderImageElement, IRenderImageElement, createBesierEasing } from './utils';
import { ITimingFunction } from './utils';

type IFillMode = 'none'|'forwards'|'backwards'|'both'
type OriType = 'ltr'|'rtl'
type IDrawType = 'background'|'transform'|'imgSrc'

/**
 * @param totalFrameNumber number 总帧数（序列图总数）
 * @param direction "vertical"|"horizontal" 绘制帧方向 默认"vertical"
 * @param duration number 1s内帧数 默认60帧
 * @param infinite boolean 无限播放
 * @param timingFunction array｜string 贝塞尔曲线
 * @param delay number 延迟时间
 * @param fillMode 'none'|'forwards'|'backwards'|'both' 动画结束后状态
 * @param imgSrcList string[] 替换图片刷新动画帧使用的src数组
 * @param prefetch boolean 是否预加载 imgSrcList
 */
interface IConfig {
  totalFrameNumber: number;
  direction?: 'vertical' | 'horizontal';
  duration?: number;
  infinite?: boolean;
  timingFunction?: ITimingFunction;
  delay?: number;
  fillMode?: IFillMode;
  imgSrcList?: string[];
  prefetch?: boolean;
}

/**
 * 另一种尝试：使用累计动画时间百分比确定执行到了哪一步
 * fillMode未实现
 * continue interrupt未实现
 **/
class SinglelineFrameAnimation {
  public config: Required<IConfig> = {
    totalFrameNumber: 0,
    direction: 'vertical',
    duration: 1000,
    infinite: false,
    timingFunction: 'linear',
    delay: 0,
    fillMode: 'none',
    imgSrcList: [],
    prefetch: false,
  };
  public element;
  private drawType?: IDrawType;
  /** 贝塞尔函数，为节约计算资源，每次start时计算 */
  private easingFunction?: BezierEasing.EasingFunction;
  /** 首次进入raf */
  public firstStart = true;
  /** 上一次绘制时间 */
  public lastStartTimestamp = 0;
  /** 上一次绘制帧 */
  public lastCurrentFrame = 0;
  /** 累计时间 */
  public cumulativeTime = 0;
  /** hooks */
  public onstart = () => void 0;
  public onprefetch = (result: boolean[]) => void 0;
  public onupdate = (startTimestamp: DOMHighResTimeStamp) => void 0;
  public oncomplete = (startTimestamp: DOMHighResTimeStamp) => void 0;
  /** side effect */
  public rafSymbol: number|null = null;

  constructor(ele: HTMLElement|null|undefined, config?: IConfig, drawType?: IDrawType) {
    if(drawType === 'transform' && !isHTMLElement(ele)) {
      console.warn("Element should be <picture> or <img> when draw type is transform");
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
      this.onprefetch(result)
    }
  }

  /** 动画执行预设多久 */
  private _calcFrameInterval (startTimestamp: DOMHighResTimeStamp) {
    /** 一帧时间间隔 */
    // const originInterval = 1000 / (typeof this.config.fps === 'number' ? this.config.fps : 60);
    const percent = this.cumulativeTime/this.config.duration
    const easingPercent = this.easingFunction?.(percent) ?? percent
    return Math.ceil(easingPercent*1000)/1000;
  }

  /**
   * 一帧跨越的百分比
   * backgroundPosition与transfrom不太一致，特殊处理。
   **/
  private _calcOneFramePercent () {
    return 1 / (this.config.totalFrameNumber - (this.drawType === 'transform' ? 0 : 1)) * 100;
  }

  /**
   * 计算当前在第几张画面
   * 超过totalFrameNumber时，则继续从0开始开始计算。
   **/
  private _calcCurrentFrame (currentFrame: number, type: OriType) {
    const tolerenceCurrentFrame = currentFrame % this.config.totalFrameNumber;
    if(type === 'rtl') {
      return this.config.totalFrameNumber - tolerenceCurrentFrame - 1;
    }
    return tolerenceCurrentFrame;
  }

  /** 移动backgroundPosition跳到下一帧 */
  private _drawBackground(currentFrame: number, type: OriType) {
    if (!isHTMLElement(this.element)) {
      return;
    }
    const current = this._calcCurrentFrame(currentFrame, type);
    const framePercent = this._calcOneFramePercent();
    if (this.config.direction === 'horizontal') {
      this.element!.style.backgroundPosition = `${current * framePercent}% 0`;
    } else {
      this.element!.style.backgroundPosition = `0 ${current * framePercent}%`;
    }
  }

  /** 移动transform跳到下一帧 */
  private _drawTransform(currentFrame: number, type: OriType) {
    if (!isHTMLElement(this.element)) {
      return;
    }
    const current = this._calcCurrentFrame(currentFrame, type);
    const framePercent = this._calcOneFramePercent();
    if (this.config.direction === 'horizontal') {
      this.element!.style.transform = `translate(-${current * framePercent}%, 0)`;
    } else {
      this.element!.style.transform = `translate(0, -${current * framePercent}%)`;
    }
  }

  /** 更新src跳到下一帧 */
  private _drawImageSource(currentFrame: number, type: OriType) {
    if (!isRenderImageElement(this.element)) {
      return;
    }
    const current = this._calcCurrentFrame(currentFrame, type);
    (this.element as IRenderImageElement).src = this.config.imgSrcList[current];
  }

  private _renderFrame(currentFrame: number, type: OriType) {
    if(this.drawType === 'transform') {
      this._drawTransform(currentFrame, type);
    } else if(this.drawType === 'imgSrc') {
      this._drawImageSource(currentFrame, type);
    } else {
      this._drawBackground(currentFrame, type);
    }
  }

  /**
   * 绘制
   * @param once boolean 下一帧动画执行完成后终止（特殊用途）
   **/
  private draw (type: OriType = 'ltr', startTimestamp: DOMHighResTimeStamp, once?: boolean) {
    const cacheRafSymbol = this.rafSymbol;
    if(this.firstStart) {
      this.firstStart = false;
      this.lastStartTimestamp = startTimestamp;
      this.cumulativeTime = this.config.delay;
    }
    const frameIntervalPercent = this._calcFrameInterval(startTimestamp);

    // 判断是否终止绘制，或已绘制到最后一张
    if (frameIntervalPercent >= 1) {
      this.oncomplete(startTimestamp);
      // 无限循环
      if (this.config.infinite) {
        this.start(type);
        return;
      }
      return;
      // 不维持最后一步状态时，触发一次渲染回到第一次
      // if(this.config.fillMode !== 'both' && this.config.fillMode !== 'forwards' && cacheRafSymbol === this.rafSymbol) {
      //   // this.currentFrame += 1;
      //   this._setRaf(type, cacheRafSymbol, true);
      //   return;
      // }
    }
    this.cumulativeTime += (startTimestamp - this.lastStartTimestamp)
    this.lastStartTimestamp = startTimestamp;
    const currentFrame = Math.ceil(this.config.totalFrameNumber * frameIntervalPercent);
    this._renderFrame(currentFrame, type);
    if(this.lastCurrentFrame !== currentFrame) {
      this.onupdate(startTimestamp)
      this.lastCurrentFrame = currentFrame;
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
    this.cumulativeTime = 0;
    // 获得贝塞尔函数
    this.easingFunction = createBesierEasing(this.config.timingFunction);
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
    this.firstStart = true;
    this.cumulativeTime = 0;
  }
}

export default SinglelineFrameAnimation;
