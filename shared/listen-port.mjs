export function serviceListenOptions(defaultPort, env = process.env) {
  return {port:Number(env.HG_PORT ?? env.PORT ?? defaultPort),attempts:env.HG_PORT === undefined ? 11 : 1};
}

export function listenWithFallback(server, basePort, host, attempts = 11, warn = console.warn) {
  return new Promise((resolve,reject)=>{
    if(!Number.isInteger(basePort)||basePort<0||basePort>65535||!Number.isInteger(attempts)||attempts<1){reject(Error('端口必须为 0–65535 的整数，尝试次数必须大于 0。'));return;}
    let port=basePort,tried=0;
    const cleanup=()=>{server.off('error',onError);server.off('listening',onListening);};
    const onListening=()=>{cleanup();resolve(server.address().port);};
    const onError=error=>{
      if(error.code==='EADDRINUSE'&&basePort!==0&&++tried<attempts&&port<65535){warn(`端口 ${port} 被占用，尝试 ${port+1}…`);port++;listen();return;}
      cleanup();
      const range=basePort===port?String(port):`${basePort}–${port}`;
      const failure=new Error(`无法监听端口 ${range}（${error.code||error.message}）。请检查并释放所属端口：Windows 使用 netstat -ano；Linux/macOS 使用 lsof -i :${basePort}。也可设置 HG_PORT 指定其他端口。`,{cause:error});
      failure.code=error.code;reject(failure);
    };
    const listen=()=>{try{server.listen(port,host);}catch(error){onError(error);}};
    server.on('error',onError);server.once('listening',onListening);listen();
  });
}
