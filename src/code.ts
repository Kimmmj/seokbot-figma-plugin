function 필요한것만(arr: Array<any>) {
  return arr.map(item => {
    console.log('item.fields.Button', item.fields.Button)
    const [cancel, ok] = item.fields.Button ? item.fields.Button?.split(' / ') : ['', '']
    return ({
    title: item.fields.Title,
    desc: item.fields.Description,
    button: {
      cancel,
      ok
    },
    comp: item.fields.Component,
  })
})
}

async function fetchAirtableData() {
  const response = await fetch(`https://api.airtable.com/v0/appIweCwukWXWM1no/tblGPBQZDdHxGua7f?view=viwHHNlyRPe2n7Q85`, {
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer patCoq2MEGY3wp0tZ.c92d3bcf58b7fa86de905831b0e67db37805b83bd74f14d64c6863955b7e604c`
    }
  });

  const data = await response.json();
;
  return data.records.length > 0 ? 필요한것만(data.records) : 'No data found';
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

let openAIToken: string | null = null; // openAIToken 변수를 let으로 선언

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'set-token') {
    openAIToken = msg.token; // 토큰을 저장

    // 토큰을 clientStorage에 저장
    await figma.clientStorage.setAsync('openAIToken', openAIToken);
    figma.notify('토큰이 저장되었습니다.');
  }

  if (msg.type === 'submit-question') {
    const question = msg.question;
    const selectedComponent = msg.component; // 선택된 컴포넌트 값 받기

    const airtableAnswer = await fetchAirtableData();
    if (!airtableAnswer) {
      figma.notify('Airtable에서 데이터를 찾을 수 없습니다.');
      return;
    }
    
    let prompt;
    
    if (selectedComponent === 'Modal / Confirm') {
      prompt = `
        ${JSON.stringify(airtableAnswer)} 여기 데이터에서 component 컬럼 중 Modal이고 button 컬럼에 '/' 특수문자가 있는 데이터는 Modal/Confirm에서 버튼 레이블로 사용되고 있습니다.
        위 데이터를 참고하여 "${question}" 에 맞는 문구를 만들어주세요.
        컴포넌트는 ${selectedComponent}입니다.
        응답 형식은 다음과 같아야 합니다:
        title: [제목]
        description: [설명]
        ok: [확인 버튼]
        cancel: [취소 버튼]
      `;
    } else if (selectedComponent === 'Modal / Alert') {
      prompt = `
        ${JSON.stringify(airtableAnswer)} 여기 데이터에서 component 컬럼 중 Modal이고 button 컬럼에 '/' 특수문자가 없는 데이터는 Modal/Alert에서 버튼 레이블로 사용되고 있습니다.
        위 데이터를 참고하여 "${question}" 에 맞는 문구를 만들어주세요.
        컴포넌트는 ${selectedComponent}입니다.
        응답 형식은 다음과 같아야 합니다:
        title: [제목]
        description: [설명]
        ok: [확인 버튼]
      `;
    } else {
      figma.notify('유효하지 않은 컴포넌트입니다.');
      return;
    }

    // openAIToken이 null이 아닐 때만 API 호출
    if (openAIToken) {
      const gptResponse = await fetchChatGPTResponse(prompt, openAIToken);
      if (!gptResponse) {
        figma.notify('GPT 응답이 없습니다.');
        return;
      }
      console.log('GPT Response:', gptResponse); // gptResponse의 내용을 로그로 출력
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(gptResponse); // JSON 파싱 시도
      } catch (error) {
        figma.notify('GPT 응답을 파싱하는 중 오류가 발생했습니다.'); // 오류 발생 시 알림
        console.error('JSON Parse Error:', error);
        return; // 오류 발생 시 함수 종료
      }
      const { title, description, ok, cancel } = parsedResponse; // 파싱된 응답 사용

      const selectedFrames = figma.currentPage.selection.filter(node => node.type === 'FRAME' || node.type === 'INSTANCE') as (FrameNode | InstanceNode)[];
      if (selectedFrames.length === 0) {
        figma.notify('컴포넌트를 선택하세요.');
        return;
      }

      const selectedFrame = selectedFrames[0];

      // 컴포넌트 타입에 따라 필요한 레이어 설정
      await setTextInFrame(selectedFrame, 'title', title);
      await setTextInFrame(selectedFrame, 'description', description);
      await setTextInFrame(selectedFrame, 'ok', ok);
      await setTextInFrame(selectedFrame, 'cancel', cancel);

      figma.notify(`${selectedFrame.name} 컴포넌트가 업데이트되었습니다.`);
    } else {
      figma.notify('유효한 OpenAI API 토큰이 필요합니다.');
    }
  }
};

// 플러그인 시작 시 저장된 토큰을 불러오기
async function loadToken() {
  const storedToken = await figma.clientStorage.getAsync('openAIToken');
  if (storedToken) {
    openAIToken = storedToken; // 불러온 토큰을 변수에 저장
    // UI에 저장된 토큰을 표시하거나 사용할 수 있습니다.
    figma.ui.postMessage({ type: 'load-token', token: storedToken });
  }
}

// Figma 플러그인의 UI를 보여줍니다.
figma.showUI(__html__, { width: 300, height: 500 });

// 플러그인 시작 시 저장된 토큰 불러오기
loadToken();

// 특정 프레임 안의 텍스트 레이어에 텍스트를 설정하는 함수
async function setTextInFrame(frame: FrameNode | InstanceNode, targetNode: string, text: string) {
  const layer = frame.findOne(node => node.type === 'TEXT' && node.name === targetNode) as TextNode;


  if (targetNode) {
    const a = await figma.loadFontAsync(layer.fontName as FontName);
    console.log({a})
    layer.characters = text;
  } else {
    figma.notify('title 레이어를 찾을 수 없습니다.');
  }
}

async function fetchChatGPTResponse(prompt: string, token: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // 입력받은 토큰 사용
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50
    })
  });

  if (!response.ok) {
    console.error('Error with API:', response.status, response.statusText);
    return; // 문제가 있으면 null 반환
  }

  const data = await response.json();
  const gptResponse = data.choices?.[0]?.message?.content || 'No response received';

  return gptResponse;
}