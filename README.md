# AEAI Web

前端项目基于 [Vue 3](https://vuejs.org/) 和 [Vite](https://vitejs.dev/) 构建。

## 环境要求

- Node.js 18 及以上
- npm 8 及以上

## 开发

1. 复制 `.env.example` 为 `.env`，根据实际情况修改 `VITE_API_BASE_URL`。
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动开发服务器：
   ```bash
   npm run dev
   ```

## 构建

```bash
npm run build
```

构建后的静态文件位于 `dist/` 目录。

## 运行

后端服务需提供与 `VITE_API_BASE_URL` 对应的接口。
启动后访问 `/` 即可。

## 许可证

本项目使用 [MIT](LICENSE) 许可证。
