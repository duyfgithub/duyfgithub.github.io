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

// 自动调整textarea高度
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
}

// 为textarea添加输入事件监听
messageInput.addEventListener('input', autoResizeTextarea);

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
  div.innerHTML = marked.parse(content);
  return div;
}

// 滚动到底部
function scrollToBottom() {
    const threshold = 50; // 距离底部的阈值
    const isNearBottom = chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight <= threshold;
    if (isNearBottom) {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}

// 显示配置模态框
showConfigBtn.addEventListener('click', () => {
  configModal.style.display = 'block';
  apiKeyInput.value = localStorage.getItem('api-key') || '';
  if (providerSelect.value === 'DEEPSEEK') {
    modelSelect.value = localStorage.getItem('model') || '';
  } else {
    modelSelect.value = localStorage.getItem('model') || '';
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
// 输入框处理逻辑：Enter发送消息，Shift+Enter换行
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  } else if (e.key === 'Enter' && e.shiftKey) {
    autoResizeTextarea();
  }
});

// 绑定取消按钮点击事件
document.getElementById('cancelBtn').addEventListener('click', cancelMessage);

// 固定内容定义
const FIXED_CONTENT = '请回答以下问题，如果句子太长注意分句，另外用markdown组织回答内容：\n';

// AbortController实例
let abortController;

// 取消消息
function cancelMessage() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    sendBtn.disabled = false;
    messageInput.disabled = false;
    cancelBtn.style.display = 'none';
}

// 发送消息
async function sendMessage() {
    // 初始化AbortController
    abortController = new AbortController();
    const messageText = messageInput.value.trim();
    
    // 去除消息结尾的换行符
    sendBtn.disabled = true;
    messageInput.disabled = true;
    cancelBtn.style.display = 'inline-block';
  console.log("Starting sendMessage");
  
  // 拼接固定内容
  const formattedMessage = FIXED_CONTENT + messageText;
  
  const apiKey = localStorage.getItem('api-key');
  const provider = providerSelect.value;
  const model = localStorage.getItem('model');

  if (!messageText) return;
  if (!apiKey || !model) {
    alert('请先配置API');
    configModal.style.display = 'block';
    return;
  }

  messageInput.value = '';
  chatHistory.appendChild(createMessageElement(formattedMessage, true));
  scrollToBottom();

  const assistantMessageContainer = createMessageElement('', false);
  chatHistory.appendChild(assistantMessageContainer);

  // 构建消息数组
  const messages = [
    {
      role: "user",
      content: formattedMessage
    }
  ];
  
  try {

    const response = await fetch(API_PROVIDERS[provider].endpoint, {
        method: 'POST',
        signal: abortController.signal,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
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
                markdownContainer.innerHTML = marked.parse(responseText);
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
      if (error.name === 'AbortError') {
          assistantMessageContainer.textContent = '操作已取消';
          console.log('请求被取消');
      } else {
          assistantMessageContainer.textContent = `错误：${error.message}`;
          console.error('请求失败', error);
      }
      sendBtn.disabled = false;
      messageInput.disabled = false;
      cancelBtn.style.display = 'none';
      messageInput.focus();
  }
  sendBtn.disabled = false;
  messageInput.disabled = false;
  cancelBtn.style.display = 'none';
  scrollToBottom();
}