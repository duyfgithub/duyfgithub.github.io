// API配置
const API_PROVIDERS = {
  DEEPSEEK: {
    endpoint: 'https://api.deepseek.com/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  ALYUN: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: ['deepseek-r1', 'deepseek-v3', 'qwen-plus', 'qwen-max']
  }
};

// 获取DOM元素
const chatHistory = document.getElementById('chatHistory');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const showConfigBtn = document.getElementById('showConfigBtn');
const configModal = document.getElementById('configModal');
const providerSelect = document.getElementById('providerSelect');
const modelSelect = document.getElementById('modelSelect');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveConfigBtn = document.getElementById('saveConfigBtn');

// 刷新模型选项
function refreshModelOptions(provider) {
  const modelSelect = document.getElementById('modelSelect');
  modelSelect.innerHTML = '';
  if (API_PROVIDERS[provider].models) {
    API_PROVIDERS[provider].models.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });
  }
}

// 处理API提供商变更
function handleProviderChange() {
  const provider = providerSelect.value;
  const modelSelectGroup = document.getElementById('modelSelectGroup');
  modelSelectGroup.style.display = 'block';
  refreshModelOptions(provider);
  
  // 自动保存选择的模型
  if (provider === 'DEEPSEEK') {
    const model = modelSelect.value;
    localStorage.setItem('model', model);
  }
}

// 消息模板
function createMessageElement(content, isUser = true) {
  const div = document.createElement('div');
  div.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
  div.innerHTML = content.replace(/\n/g, '<br>');
  return div;
}

// 滚动到底部
function scrollToBottom() {
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 显示配置模态框
showConfigBtn.addEventListener('click', () => {
  configModal.style.display = 'block';
  apiKeyInput.value = localStorage.getItem('api-key') || '';
  if (providerSelect.value === 'DEEPSEEK') {
    modelSelect.value = localStorage.getItem('model') || '';
  } else {
    modelInput.value = localStorage.getItem('model') || '';
  }
});

// 关闭模态框
document.querySelector('.close').addEventListener('click', () => {
  configModal.style.display = 'none';
});


// 保存配置
function saveConfig() {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;

  if (apiKey) {
    localStorage.setItem('api-key', apiKey);
  }
  
  if (model) {
    localStorage.setItem('model', model);
  }

  configModal.style.display = 'none';
  alert('配置保存成功');
  console.log('配置成功保存');
}

// 事件监听
providerSelect.addEventListener('change', handleProviderChange);
saveConfigBtn.addEventListener('click', saveConfig);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// 发送消息
async function sendMessage() {
  const message = messageInput.value.trim();
  const apiKey = localStorage.getItem('api-key');
  const provider = providerSelect.value;
  const model = localStorage.getItem('model');

  if (!message) return;
  if (!apiKey || !model) {
    alert('请先配置API');
    configModal.style.display = 'block';
    return;
  }

  messageInput.value = '';
  chatHistory.appendChild(createMessageElement(message, true));
  scrollToBottom();

  const assistantMessageContainer = createMessageElement('', false);
  chatHistory.appendChild(assistantMessageContainer);
  
  try {

    const response = await fetch(API_PROVIDERS[provider].endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{
          role: 'user',
          content: message
        }],
        temperature: 0.7,
        stream: true
      })
    });

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = '';
    
    // 创建 Markdown 渲染容器
    const markdownContainer = document.createElement('div');
    assistantMessageContainer.appendChild(markdownContainer);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.replace('data: ', '');
          if (data !== '[DONE]') {
            try {
              const jsonData = JSON.parse(data);
              if (jsonData.choices && jsonData.choices[0].delta) {
                if (jsonData.choices[0].delta.reasoning_content) {
                  responseText += jsonData.choices[0].delta.reasoning_content;
                } else if (jsonData.choices[0].delta.content) {
                  responseText += jsonData.choices[0].delta.content;
                }
                // 使用 innerHTML 保持格式
                markdownContainer.innerHTML = responseText;
                scrollToBottom();
              } else if (jsonData.error) {
                throw new Error(jsonData.error.message);
              }
            } catch (error) {
              console.error('Error parsing chunk:', error);
              assistantMessageContainer.textContent = '错误：无法解析响应数据';
            }
          }
        } else if (line.startsWith('event: error')) {
          throw new Error('服务器发生错误');
        }
      }
    }
  } catch (error) {
    assistantMessageContainer.textContent = `错误：${error.message}`;
  }
  scrollToBottom();
}
