function addBackgroundAnimation() {
  const instance = new FrameAnimation.SinglelineFrameAnimation(
    document.querySelector("#background"),
    {
      totalFrameNumber: 24,
      imageDirection: "vertical",
      fillMode: 'both',
      infinite: true,
      fps: 60,
    },
  )
  instance.start('ltr')
};

function addTransformAnimation() {
  const instance = new FrameAnimation.SinglelineFrameAnimation(
    document.querySelector("#transform"),
    {
      totalFrameNumber: 8,
      imageDirection: "horizontal",
      infinite: true,
      fps: 24,
    },
    "transform"
  )
  instance.start('ltr')
};

// (function () {
//   const instance = new FrameAnimation.SinglelineFrameAnimation2(
//     document.querySelector("#background"),
//     {
//       totalFrameNumber: 24,
//       direction: "vertical",
//       duration: 2000,
//       delay: -1000,
//       timingFunction: [1,0,0,1]
//     },
//   )
//   let type = 'rtl';
//   let count = 0;
//   instance.start(type)
//   instance.onupdate = () => {
//     count++;
//     if(count === 20) {
//       instance.continue('ltr')
//     }
//   }
// })();

function addMultilineBackgroundTransform() {
  const instance = new FrameAnimation.MultilineFrameAnimation(
    document.querySelector("#multibackground"),
    {
      totalFrameNumber: 36,
      columnNumber: 6,
      motionDirection: 'alternate',
      fps: 40,
    },
  )
  instance.start('ltr')
};

window.onload = () => {
  addBackgroundAnimation();
  addMultilineBackgroundTransform();
  addTransformAnimation();
}
