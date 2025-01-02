"use strict";
document.addEventListener('DOMContentLoaded', () => {
    console.log('UI Loaded'); // UI가 로드될 때 이 로그가 찍히는지 확인
    const submitButton = document.getElementById('submit');
    submitButton === null || submitButton === void 0 ? void 0 : submitButton.addEventListener('click', () => {
        console.log('Submit 버튼 클릭됨');
        const questionInput = document.getElementById('question');
        const question = questionInput === null || questionInput === void 0 ? void 0 : questionInput.value;
        if (question.trim() === '') {
            alert('질문을 입력하세요.');
            return;
        }
        // 백엔드 코드로 메시지 전달
        parent.postMessage({ pluginMessage: { type: 'submit-question', question } }, '*');
    });
});
onmessage = (event) => {
    if (event.data.pluginMessage.type === 'result') {
        const result = event.data.pluginMessage.data;
        document.getElementById('result').innerText = result.output;
    }
};
