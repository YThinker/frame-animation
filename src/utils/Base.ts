import { MultilineConfig } from 'MultilineFrameAnimation';
import raf from 'raf';
import { SinglelineConfig } from 'SinglelineFrameAnimation';
import { IStatus, OriType } from './types';

abstract class Base {
  public abstract config: Required<SinglelineConfig|MultilineConfig>;
  protected status: IStatus = 'termination';
  protected type: OriType = 'ltr';
  public element;
  /** 当前在第几帧 */
  public currentFrame = 0;
  /** 上一次绘制时间 */
  protected lastStartTimestamp = 0;
  /** hooks */
  public onstart?: (self: this) => void;
  public onupdate?: (startTimestamp: DOMHighResTimeStamp, self: this) => void;
  public oncomplete?: (startTimestamp: DOMHighResTimeStamp, self: this) => void;
  public oncancel?: (self: this) => void;
  /** side effect */
  public rafSymbol: number|null = null;

  constructor(ele: HTMLElement|null|undefined) {
    this.element = ele;
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
  protected abstract _calcOneFramePercent(): number | Record<'rowPercent'|'columnPercent', number>;

  /**
   * 计算当前在第几张画面
   * 超过totalFrameNumber时，则继续从0开始开始计算。
   **/
  protected abstract _calcCurrentFrame(type: OriType): number | Record<'current'|'currentRow'|'currentColumn', number>;

  /** 移动backgroundPosition跳到下一帧 */
  protected abstract _drawBackground(type: OriType): void;

  /** 移动transform跳到下一帧 */
  protected abstract _drawTransform(type: OriType): void;

  /** 移动offset跳到下一帧 */
  protected abstract _drawOffset(type: OriType): void;

  abstract renderFrame(currentFrame: number, type: OriType): void;

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
      this.type = type;
      this.status = 'running';

      // 判断是否终止绘制，或已绘制到最后一张
      if (this.currentFrame + (this.config.infinite ? 0 : 1) === this.config.totalFrameNumber) {
        this.oncomplete?.(startTimestamp, this);
        // 交替播放
        if(this.config.motionDirection === 'alternate') {
          this.continue(true);
          return;
        }
        // 无限循环
        if (this.config.infinite) {
          this.status = 'infiniteContinue'
          this.start(type);
          return;
        }
        // 不维持最后一步状态时，触发一次渲染回到第一次
        if(this.config.fillMode !== 'both' && this.config.fillMode !== 'forwards' && cacheRafSymbol === this.rafSymbol) {
          this.currentFrame += 1;
          this._setRaf(type, cacheRafSymbol, true);
        }
        this.status = 'termination';
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

  protected abstract clearStyle(): void;

  /** 启动 */
  start(type?: OriType) {
    if(this.status === 'running') {
      return;
    }
    this.currentFrame = 0 - this.config.delayFrame;
    this.lastStartTimestamp = 0;
    // 清除上一次绘制
    if(typeof this.rafSymbol === 'number') raf.cancel(this.rafSymbol);
    // 开始绘制
    this._setRaf(type ?? 'ltr');
    this.onstart?.(this);
  }

  /** 从中断位置继续 */
  continue(reverse?: boolean) {
    if(this.status === 'running' && !reverse) {
      return;
    }
    // 清除上一次绘制
    if(typeof this.rafSymbol === 'number') raf.cancel(this.rafSymbol);
    let type = this.type;
    if(reverse) {
      this.currentFrame = this.config.totalFrameNumber - this.currentFrame;
      type = this.type === 'ltr' ? 'rtl' : 'ltr';
    }
    // 开始绘制
    this._setRaf(type);
  }

  /** 中断 */
  interrupt() {
    if(typeof this.rafSymbol === 'number') raf.cancel(this.rafSymbol);
    this.rafSymbol = null;
    this.status = 'termination';
  }

  /** 终止 */
  cancel() {
    if(typeof this.rafSymbol === 'number') raf.cancel(this.rafSymbol);
    this.rafSymbol = null;
    this.currentFrame = 0;
    this.lastStartTimestamp = 0;
    this.status = 'termination';
    /** clear inject style */
    this.clearStyle();
    this.oncancel?.(this);
    this.element = null;
  }
}

export default Base;
