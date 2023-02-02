function formatNumberInput () {
  document.querySelectorAll('.number-input').forEach(el => {
    el.addEventListener('input', event => {
      const { value } = event.target;
      if(!/^\d*$/.test(value)) {
        event.target.value = value.replace(/[^\d]+/g, '');
      }
      if(Number(value) > Number.MAX_SAFE_INTEGER) {
        event.target.value = Number.MAX_SAFE_INTEGER - 1;
      }
    })
  })
}

function setResult (result, error) {
  const textarea = document.getElementById('result');
  if(error) {
    textarea.style = 'color: red;';
  } else {
    textarea.style = undefined;
  }
  textarea.value = result;
}

function generateFrame (type, i, totalFrameCount, columnsNumber, columnPercent, rowPercent) {
  const currentFrame = Math.abs(i) % totalFrameCount;
  const currentRow = Math.floor(currentFrame / columnsNumber);
  const currentColumn = currentFrame % columnsNumber;
  if(type === 'background-position') {
    return `background-position: ${currentColumn * columnPercent}% ${currentRow * rowPercent}%;`;
  } else if (type === 'transform') {
    return `transform: translate(-${currentColumn * columnPercent}%, -${currentRow * rowPercent}%)`;
  } else if (type === 'offset') {
    return `left: -${currentColumn * 100}%;
    top: -${currentRow * 100}%;`;
  }
}
function keyframesGenerator (totalFrameCount, columnsNumber, type) {
  const rowsNumber = Math.ceil(totalFrameCount/columnsNumber);
  let columns = columnsNumber;
  let rows = rowsNumber;
  if(type === 'background-position') {
    columns -= 1;
    rows -= 1;
  }
  const rowPercent = 1 / rows * 100;
  const columnPercent = 1 / columns * 100;
  const timePercent = 1 / (totalFrameCount - 1) * 100;
  let template = '@keyframes $replace {';
  for(let i = 0; i < totalFrameCount; i++) {
    template +=`
  ${timePercent * i}% {
    ${generateFrame(type, i, totalFrameCount, columnsNumber, columnPercent, rowPercent)}
  }`
  }
  template += `\n}`
  setResult(template)
}

function addSubmitListener () {
  document.querySelector('#submit').addEventListener('click', e => {
    const totalFrameCount = document.getElementById('totalFrame').value;
    const columnsNumber = document.getElementById('columnsNumber').value;
    const type = document.getElementById('type').value;
    if(isNaN(totalFrameCount)) {
      setResult("Total Frame Count is NaN", true);
      return;
    }
    if(isNaN(columnsNumber)) {
      setResult("Columns Number is NaN", true);
      return;
    }
    const totalFrameCountNumber = Number(totalFrameCount);
    const columnsNumberNumber = Number(columnsNumber);
    if(totalFrameCountNumber < columnsNumberNumber) {
      setResult("Total Frame Count can't be bigger than Columns Number", true);
      return;
    }
    keyframesGenerator(totalFrameCountNumber, columnsNumberNumber, type);
  });
}

window.onload = () => {
  formatNumberInput();
  addSubmitListener();
}
