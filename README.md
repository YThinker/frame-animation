# frame-animation
controllable frame animation.

# Usage
## Single-line
### html
```html
<div class="transform-container">
  <img id="transform" src="./statics/management-icon.png" class="animation-img">
</div>
```
### css
```css
.transform-container{
  width: 103px;
  height: 103px;
  overflow: hidden;
}

.transform-container > .animation-img{
  width: 100%;
  height: auto;
}
```
### js
```javascript
const transformInstance = new FrameAnimation.SinglelineFrameAnimation(
  document.querySelector("#transform"),
  {
    /** @required */
    totalFrameNumber: 24,
    /** @defaultValue 'vertical' */
    imageDirection: "vertical",
    fillMode: 'both',
    motionDirection: 'alternate',
    /** @defaultValue 60 */
    fps: 1,
  },
  "transform"
);
transformInstance.start();
```
## Multiline
### html
```html
<div class="multitransform-container">
  <img id="multitransform" src="./statics/apple-lock-icon.png">
</div>
```
### css
```css
.multitransform-container{
  width: 66px;
  height: 88px;
  overflow: hidden;
  background-color: #000;
}
```
### js
```javascript
const transformInstance = new FrameAnimation.MultilineFrameAnimation(
  document.querySelector("#multitransform"),
  {
    /** @required */
    totalFrameNumber: 36,
    /** @required */
    columnNumber: 6,
    fps: 10,
  },
  "transform"
)
let type = 'ltr';
transformInstance.start(type)
```
