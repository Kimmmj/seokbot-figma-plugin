"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function 필요한것만(arr) {
    return arr.map(item => {
        var _a;
        const [cancel, ok] = item.fields.Button ? (_a = item.fields.Button) === null || _a === void 0 ? void 0 : _a.split(' / ') : ['', ''];
        return ({
            title: item.fields.Title,
            desc: item.fields.Description,
            button: { cancel, ok },
            comp: item.fields.Component,
        });
    });
}
function fetchAirtableData() {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(`https://api.airtable.com/v0/appIweCwukWXWM1no/tblGPBQZDdHxGua7f?view=viwHHNlyRPe2n7Q85`, {
            method: 'get',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer patCoq2MEGY3wp0tZ.c92d3bcf58b7fa86de905831b0e67db37805b83bd74f14d64c6863955b7e604c`
            }
        });
        const data = yield response.json();
        ;
        return data.records.length > 0 ? 필요한것만(data.records) : 'No data found';
    });
}
const INPUT_COMPONENTS = [
    // 'timeinput',
    // 'passwordinput',
    // 'textinput',
    // 'numberinput',
    // 'radio',
    // 'checkbox',
    // 'select',
    // 'nativeselect',
    // 'notification',
    'Modal / Confirm',
    'Modal / Alert'
];
const openAITokenObj = { token: null }; // openAIToken을 객체로 선언
// UI 초기화
function loadUIState() {
    return __awaiter(this, void 0, void 0, function* () {
        const savedToken = yield figma.clientStorage.getAsync('openAIToken'); // 저장된 토큰 가져오기
        figma.ui.postMessage({ type: 'load-token', token: savedToken || '' }); // HTML로 전달
        editStartToken = savedToken || ''; // 초기화 시 동기화
        currentToken = savedToken || ''; // 초기화 시 동기화
    });
}
function checkStoredToken() {
    return __awaiter(this, void 0, void 0, function* () {
        const storedToken = yield figma.clientStorage.getAsync('openAIToken');
        console.log('Stored token:', storedToken);
    });
}
checkStoredToken();
// 전역 변수 선언
let currentToken = ''; // 현재 토큰 값을 저장하는 변수
let editStartToken = ''; // 수정 시작 시의 값을 저장하는 변수
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    const { type, token } = msg;
    if (type === 'start-edit') {
        editStartToken = token; // 수정 시작 시 현재 값을 저장
    }
    if (type === 'cancel-edit') {
        figma.ui.postMessage({ type: 'restore-token', token: editStartToken }); // 수정 취소 시 HTML로 복원 값 전달
    }
    if (type === 'save-token') {
        try {
            // Figma clientStorage에 저장
            yield figma.clientStorage.setAsync('openAIToken', token);
            figma.ui.postMessage({ type: 'token-saved', success: true });
        }
        catch (error) {
            console.error('저장 중 오류 발생:', error);
            figma.ui.postMessage({
                type: 'token-saved',
                success: false,
                error: error.message, // 명시적으로 Error로 타입 캐스팅
            });
        }
    }
    if (msg.type === 'submit-question') {
        const question = msg.question;
        const selectedComponent = msg.component;
        if (!openAITokenObj.token) {
            figma.notify('유효한 OpenAI API 토큰이 필요합니다.');
            return;
        }
        const airtableAnswer = yield fetchAirtableData();
        if (!airtableAnswer) {
            figma.notify('Airtable 데이터가 없습니다.');
            return;
        }
        // GPT 요청 생성 (별도 함수로 분리)
        const prompt = createPrompt(question, selectedComponent, airtableAnswer);
        const gptResponse = yield fetchChatGPTResponse(prompt, openAITokenObj.token);
        if (gptResponse) {
            handleGPTResponse(gptResponse); // 응답 처리
        }
        else {
            figma.notify('GPT 응답을 처리할 수 없습니다.');
        }
    }
    // GPT 요청 생성 함수
    function createPrompt(question, component, data) {
        const modalType = component === 'Modal / Confirm' ? 'Confirm' : 'Alert';
        return `
      ${JSON.stringify(data)}
      위 데이터를 참고하여 "${question}"에 적합한 문구를 만들어주세요.
      컴포넌트는 ${modalType}입니다.
      응답 형식:
      {
        "title": "제목",
        "description": "설명",
        "ok": "확인 버튼 텍스트",
        ${modalType === 'Confirm' ? `"cancel": "취소 버튼 텍스트"` : ''}
      }
    `;
    }
    // GPT 응답 처리 함수
    function handleGPTResponse(response) {
        try {
            const parsedResponse = JSON.parse(response); // JSON 파싱
            const { title, description, ok, cancel } = parsedResponse;
            const selectedFrames = figma.currentPage.selection.filter(node => node.type === 'FRAME' || node.type === 'INSTANCE');
            if (selectedFrames.length === 0) {
                figma.notify('컴포넌트를 선택하세요.');
                return;
            }
            const selectedFrame = selectedFrames[0];
            // 프레임 내부 텍스트 설정
            setTextInFrame(selectedFrame, 'title', title);
            setTextInFrame(selectedFrame, 'description', description);
            setTextInFrame(selectedFrame, 'ok', ok);
            setTextInFrame(selectedFrame, 'cancel', cancel);
            figma.notify(`${selectedFrame.name} 컴포넌트가 업데이트되었습니다.`);
        }
        catch (error) {
            figma.notify('GPT 응답을 파싱하는 중 오류가 발생했습니다.');
            console.error('JSON Parse Error:', error);
        }
    }
});
// Figma 플러그인의 UI를 보여줍니다.
figma.showUI(__html__, { width: 300, height: 500 });
// 플러그인 시작 시 저장된 토큰 불러오기
loadUIState(); // UI 초기화 실행
// 특정 프레임 안의 텍스트 레이어에 텍스트를 설정하는 함수
function setTextInFrame(frame, targetNode, text) {
    return __awaiter(this, void 0, void 0, function* () {
        const layer = frame.findOne(node => node.type === 'TEXT' && node.name === targetNode);
        if (!layer) {
            figma.notify(`${targetNode} 레이어를 찾을 수 없습니다.`);
            return; // 레이어가 없으면 중단
        }
        yield figma.loadFontAsync(layer.fontName);
        layer.characters = text;
    });
}
function fetchChatGPTResponse(prompt, token) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            const response = yield fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50,
                }),
            });
            if (!response.ok) {
                throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
            }
            const data = yield response.json();
            return ((_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || '응답 없음';
        }
        catch (error) {
            console.error('GPT 요청 실패:', error);
            figma.notify('GPT 요청 처리 중 오류가 발생했습니다.');
            return null;
        }
    });
}
