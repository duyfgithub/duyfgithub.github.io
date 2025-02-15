// API配置
const API_PROVIDERS = Object.freeze({
  DEEPSEEK: {
    endpoint: 'https://api.deepseek.com/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  ALYUN: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 
    models: ['deepseek-r1', 'deepseek-v3', 'qwen-plus', 'qwen-max']
  }
});

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
  const minHeight = 44; // 设置最小高度以适应移动端触摸屏
  const maxHeight = 400; // 设置最大高度
  messageInput.style.height = `${Math.min(Math.max(minHeight, messageInput.scrollHeight), maxHeight)}px`;
}

// 重置textarea高度
function resetTextareaHeight() {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${messageInput.scrollHeight}px`;
}

messageInput.addEventListener('input', autoResizeTextarea);

// 刷新模型选项
function refreshModelOptions(provider) {
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
  document.getElementById('modelSelectGroup').style.display = 'block';
  refreshModelOptions(provider);
  
  const selectedModel = modelSelect.value;
  if (selectedModel) {
    localStorage.setItem('model', selectedModel); 
  }
}

// 创建消息元素
function createMessageElement(content, isUser = true, isReasoning = false) {
  const div = document.createElement('div');
  div.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
  
  if (isReasoning) {
    const reasoningHeader = document.createElement('div');
    reasoningHeader.className = 'reasoning-header';
    reasoningHeader.textContent = '推理过程：';
    div.appendChild(reasoningHeader);
  }
  
  div.innerHTML += marked.parse(content);
  return div;
}

// 滚动到底部
function scrollToBottom() {
  const threshold = 50;
  const isNearBottom = chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight <= threshold;
  if (isNearBottom) {
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
}

// 检查必填配置
function validateRequiredConfig() {
  const apiKey = localStorage.getItem('api-key');
  const model = localStorage.getItem('model');
  if (!apiKey || !model) {
    alert('请先配置API');
    configModal.style.display = 'block';
    return false;
  }
  return true;
}

// 显示配置模态框
showConfigBtn.addEventListener('click', () => {
  configModal.style.display = 'block';
  apiKeyInput.value = localStorage.getItem('api-key') || '';
  modelSelect.value = localStorage.getItem('model') || '';
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
document.getElementById('cancelBtn').addEventListener('click', cancelMessage);

// 输入框处理
// 检测iPad设备
function isIPad() {
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

// 初始化visualViewport处理（处理键盘弹出）
function initViewportHandler() {
  if (!isIPad()) return;

  const updateViewport = () => {
    const viewport = window.visualViewport;
    const keyboardHeight = window.innerHeight - viewport.height;
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    
    // 自动滚动到输入框
    if (keyboardHeight > 100 && document.activeElement === messageInput) {
      requestAnimationFrame(() => {
        messageInput.scrollIntoView({block: 'end', behavior: 'auto'});
      });
    }
  };

  window.visualViewport.addEventListener('resize', updateViewport);
  window.visualViewport.addEventListener('scroll', updateViewport);
  updateViewport(); // 初始化调用
}

// 防抖函数
function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// 优化后的滚动处理（添加偏移补偿）
const handleIPadScroll = debounce(() => {
  requestAnimationFrame(() => {
    const inputRect = messageInput.getBoundingClientRect();
    const viewportBottom = window.innerHeight - 300; // 假设键盘高度约300px
    if (inputRect.bottom > viewportBottom) {
      const offset = inputRect.bottom - viewportBottom + 10; // 10px缓冲
      window.scrollBy({
        top: offset,
        behavior: 'auto'
      });
    }
  });
}, 100);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      sendMessage();
    } else {
      document.execCommand('insertText', false);
      autoResizeTextarea();
      if (isIPad()) {
        handleIPadScroll();
      }
    }
  }
});

// 固定内容
const FIXED_CONTENT = '请回答以下问题，如果句子太长注意分句，另外用markdown组织回答内容：\n';

let abortController;

// 取消消息
function cancelMessage() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  sendBtn.disabled = false;
  messageInput.disabled = false;
  document.getElementById('cancelBtn').style.display = 'none';
}

// 取消消息
function cancelMessage() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  sendBtn.disabled = false;
  messageInput.disabled = false;
  document.getElementById('cancelBtn').style.display = 'none';
}

// 发送消息
async function sendMessage() {
  if (!validateRequiredConfig()) return;

  abortController = new AbortController();
  const messageText = messageInput.value.trim();
  
  if (!messageText) return;

  sendBtn.disabled = true;
  messageInput.disabled = true;
  document.getElementById('cancelBtn').style.display = 'inline-block';
  console.log("Starting sendMessage");

  const formattedMessage = FIXED_CONTENT + messageText;
  messageInput.value = '';
  resetTextareaHeight();
  chatHistory.appendChild(createMessageElement(formattedMessage, true));
  scrollToBottom();

  const assistantMessageContainer = createMessageElement('', false);
  chatHistory.appendChild(assistantMessageContainer);

  try {
    const response = await fetch(API_PROVIDERS[providerSelect.value].endpoint, {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('api-key')}`
      },
      body: JSON.stringify({
        model: localStorage.getItem('model'),
        messages: [{ role: "user", content: formattedMessage }],
        temperature: 0.7,
        stream: true
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = '';
    let reasoningText = '';
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
              if (jsonData.error) {
                throw new Error(jsonData.error.message);
              }

              if (jsonData.choices && jsonData.choices[0].delta) {
                if (jsonData.choices[0].delta.reasoning_content) {
                  reasoningText += jsonData.choices[0].delta.reasoning_content;
                  const reasoningMessage = createMessageElement(reasoningText, false, true);
                  reasoningMessage.classList.add('reasoning-content');
                  markdownContainer.innerHTML = reasoningMessage.innerHTML;
                }

                if (jsonData.choices[0].delta.content) {
                responseText += jsonData.choices[0].delta.content;
                const reasoningMessage = reasoningText ? createMessageElement(reasoningText, false, true) : null;
                const normalMessage = createMessageElement(responseText, false);
                markdownContainer.innerHTML = reasoningMessage ?
                  `${reasoningMessage.innerHTML}<div class="normal-reply">${marked.parse(responseText)}</div>` :
                  marked.parse(responseText);
              }
              }
              scrollToBottom();
            } catch (error) {
              console.error('Error processing response:', error);
              assistantMessageContainer.textContent = `错误：无法处理响应数据 (${error.message})`;
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
  } finally {
    sendBtn.disabled = false;
    messageInput.disabled = false;
    document.getElementById('cancelBtn').style.display = 'none';
    messageInput.focus();
    scrollToBottom();
  }
}