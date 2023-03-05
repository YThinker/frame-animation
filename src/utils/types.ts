export type IFillMode = 'none'|'forwards'|'backwards'|'both'
export type OriType = 'ltr'|'rtl'
export type IStatus = 'termination'|'running'|'infiniteContinue'

export type MultilineDrawType = 'background'|'transform'|'offset'
export type SinglelineDrawType = 'background'|'transform'|'offset'|'imgSrc'

/**
 * @param {number} totalFrameNumber 总帧数（序列图总数）
 * @param {number} fps 1s内帧数 默认60帧
 * @param {boolean} infinite  无限播放
 * @param {number} delayFrame  延迟帧数
 * @param {'none'|'forwards'|'backwards'|'both'} fillMode 动画结束后状态
 * @param {"normal"|"alternate"} motionDirection 是否应该轮流反向播放动画
 */
export interface BaseConfig {
  totalFrameNumber: number;
  /** @defaultValue 60 */
  fps?: number;
  infinite?: boolean;
  delayFrame?: number;
  fillMode?: IFillMode;
  motionDirection?: "normal" | "alternate";
}