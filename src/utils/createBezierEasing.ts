import BezierEasing from 'bezier-easing';

export type IPresetTimingFunction = 'linear' | 'ease' | 'ease-in' | 'ease-in-out' | 'ease-out'
type TimingFunctionArray = [number, number, number, number]
export type ITimingFunction = TimingFunctionArray | IPresetTimingFunction

const presetTimingFunctin: Record<IPresetTimingFunction, TimingFunctionArray> = {
  'linear': [0.0, 0.0, 1.0, 1.0],
  'ease': [0.25, 0.1, 0.25, 1.0],
  'ease-in': [0.42, 0.0, 1.0, 1.0],
  'ease-in-out': [0.42, 0.0, 0.58, 1.0],
  'ease-out': [0.0, 0.0, 0.58, 1.0],
}

export const createBesierEasing = (timingFunction: ITimingFunction) => {
  let formatTimingFunction = presetTimingFunctin['linear'];
  if(typeof timingFunction === 'string') {
    if(presetTimingFunctin[timingFunction]) {
      formatTimingFunction = presetTimingFunctin[timingFunction];
    } else {
      console.warn('Inlegal timingFunction: ', timingFunction)
    }
  } else if(Array.isArray(timingFunction) && timingFunction.length === 4) {
    formatTimingFunction = timingFunction;
  } else {
    console.warn('Inlegal timingFunction: ', timingFunction)
  }
  return BezierEasing(...formatTimingFunction)
}
