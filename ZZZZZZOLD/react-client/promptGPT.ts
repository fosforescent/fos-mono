export const promptGPT = async (
    systemPrompt: string,
    userPrompt: string, options?: {
    temperature?: number;
  }): Promise<{
    choices: {
        message: {
            content: string;
            role: string;
        };
        finishReason: string;
    }[];
  }> => {
 
  const token = localStorage.getItem('token');
  
  if(!token) {
    throw new Error('no token')
  }

  const response: any = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo-1106',
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 300
    })
  })

  if(!response.ok) {
    throw new Error(`error ${response.status}`)
  }
  
  const messages = await response.json().then((json: any) => {
    return json 
  }).catch((error: Error) => {
    console.log('error', error)
  })

  return messages

}