import type { MutableRefObject} from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * @param ref MutableRefObj 目标元素
 * @param frameImageNumber number 总帧数（序列图总数）
 * @param direction "vertical"|"horizontal" 绘制帧方向 默认"vertical"
 * @param frameNumber number 1s内帧数 默认60帧
 * @param infinite boolean 无限播放
 * @param loop boolean 循环播放
 * @param manual boolean 手动启动
 * @param timingFunction array｜string 贝塞尔曲线
 * @param type "in"|"out" 正向播放|反向播放
 * @returns setDispatch<"in"|"out"> 设置鼠标移入还是移出
 */
interface Props {
  frameImageNumber: number;
  direction?: 'vertical' | 'horizontal';
  frameNumber?: number;
  infinite?: boolean;
  loop?: boolean;
  manual?: boolean;
  timingFunction?: number[]|string;
  type?: 'in' | 'out';
}
const useStepAnimation = (
  ref: MutableRefObject<HTMLElement | null>,
  props: Props,
) => {
  const {
    frameImageNumber,
    direction = 'vertical',
    frameNumber = 60,
    infinite = false,
    loop = false,
    manual = false,
    timingFunction,
    type: defaultType,
  } = props;

  // 正向/反向动画
  const [type, setType] = useState<'in' | 'out' | undefined>(defaultType);
  // 间隔多少秒后绘制一帧
  const frameTime = useMemo(() => 1000 / (frameNumber - 1), [frameNumber]);

  // 处理到第几帧画面
  const frameImage = useRef<number>(0);
  // 上次绘制帧的时间
  const enterTiming = useRef<number>(0);
  // requestAnimationFrame flag
  const requestFlag = useRef<number | null>(null);
  // 一帧跨越的高度 数值
  const frameHeight = useRef<number>(0);
  // 一帧跨越的高度 单位
  const frameHeightUnit = useRef<string>('px');

  // resize 重新计算 一帧高度
  useEffect(() => {
    const handleResize = () => {
      const heightString = (ref?.current && window.getComputedStyle(ref.current).height) || '0';
      const height = parseInt(heightString);
      frameHeight.current = height;
      frameHeightUnit.current = heightString.replace(height.toString(), '');
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 帧动画执行函数
  const animationFunc = (typeParam = 'in', startTimestamp: DOMHighResTimeStamp) => {
    // 获取当前时间 与 enterTiming对比 超过frameTime则绘制下一帧
    if (startTimestamp - enterTiming.current >= frameTime) {
      enterTiming.current = startTimestamp;
      // 通过离散地移动backgroundPosition跳到下一帧
      if (ref.current) {
        if (direction === 'horizontal') {
          ref.current.style.backgroundPosition = `-${frameImage.current * frameHeight.current}${
            frameHeightUnit.current
          } 0`;
        } else {
          ref.current.style.backgroundPosition = `0 -${frameImage.current * frameHeight.current}${
            frameHeightUnit.current
          }`;
        }
      }
      // 判断是否中断绘制，或已绘制到最后一张
      if (typeParam === 'in') {
        frameImage.current += 1;
        if (frameImage.current >= frameImageNumber) {
          if (!infinite) {
            return;
          }
          if (loop) {
            setType((pre) => (pre === 'in' ? 'out' : 'in'));
          } else {
            frameImage.current = 0;
          }
        }
      } else {
        if (frameImage.current <= 0) {
          if (!infinite) {
            return;
          }
          if (loop) {
            setType((pre) => (pre === 'in' ? 'out' : 'in'));
          } else {
            frameImage.current = frameImageNumber;
          }
        }
        frameImage.current -= 1;
      }
    }
    // 继续绘制
    requestFlag.current = requestAnimationFrame((startTimestamp) => animationFunc(type, startTimestamp));
  };

  // 开始绘制
  useEffect(() => {
    if (!infinite && !type) {
      return;
    }
    if (!type) {
      return;
    }

    // 终止上次绘制
    if (requestFlag.current) {
      cancelAnimationFrame(requestFlag.current);
    }

    if (frameImage.current === frameImageNumber) {
      frameImage.current -= 1;
    }

    enterTiming.current = Date.now();
    requestFlag.current = requestAnimationFrame((startTimestamp) => animationFunc(type, startTimestamp));
  }, [type]);

  // 离开页面停止动画
  useEffect(
    () => () => {
      if (requestFlag.current) {
        cancelAnimationFrame(requestFlag.current);
      }
    },
    [],
  );

  return {
    start: setType,
  };
};

export default useStepAnimation;
