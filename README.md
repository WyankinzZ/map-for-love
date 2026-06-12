![Uploading 8ec0e6225ad10b616db7f0fbd7c51b92.png…]()

# Map For Everyone

Map For Everyone 是一个本地优先的个人情侣记忆地图应用。它使用 Next.js 16 App Router、React 19、Tailwind 4 和 Electron，可以在浏览器里开发，也可以打包成桌面应用。

当前版本的目标是：数据全部保存在用户自己的电脑上，不依赖 Supabase，不需要联网认证。

## 功能

- 密码入口页，输入站点密码后进入地图。
- 中国地图、省份详情、城市回忆、照片、多图封面、编辑和删除。
- 设置页可管理管理员模式、纪念日、沿途天气城市、右下角情侣 logo、登录页照片和文案。
- 设置页支持完整备份导出、导入恢复、清空数据。
- Electron 桌面版使用 Next.js standalone 生产服务，不运行 `next dev`。
- 桌面版数据写入 Electron `userData` 目录，安装包资源目录保持只读。

## Map For Everyone 专属更新 (基于 Map of Us 二创)

基于原版 Map of Us，本项目进行了深度定制和 UI/UX 体验重构，主要修改内容如下：

1. **界面交互重构 (UI/UX 升级)**
   - 全局主题统一：将各个记忆模块统一为更加美观的白/粉/蓝 (White/Pink/Blue) 现代设计风格。
   - 弹窗化表单：去除了原本拥挤的侧边栏表单，将新增/编辑操作（纪念日、地点收藏、时光宝盒）升级为顺滑的居中弹窗 (Modal) 交互。
   - 关于界面重构：左下角的“关于我们”信息提取为独立的悬浮弹窗，让侧边导航栏更加清爽。

2. **管理模块独立与分页 (数据展示优化)**
   - **地标管理 (Landmarks)**：从各个城市卡片中独立出来，拥有专属的侧边栏入口。新增城市模糊搜索功能，并采用美观的九宫格 (9项/页) 分页展示，方便统一管理。
   - **登录照片 (Login Photos)**：从基础设置页中剥离，移至专属页面。原有的竖向长列表改为沉浸式 3x3 画廊布局，鼠标悬停即可快速唤出居中弹窗进行独立编辑。
   - 所有列表页（地点收藏、纪念日等）均统一引入了九宫格分页组件。

3. **智能小组件升级 (Smart Widgets)**
   - **纪念日轮播卡片**：首页侧边栏的纪念日不再是写死的单一日期，而是会自动读取记录并每 5 秒自动轮播。对于未来的日期，会自动切换为“倒数日”模式。
   - **天气城市组合框**：将设置中的“沿途天气”普通下拉框升级为支持模糊搜索的组合框 (Combobox)，找城市更加智能快捷。

## 桌面版密码

**首次安装后的初始密码：**

```text
进入密码：1234
管理员密码：admin1234
```

第一次打开请用上面的初始密码登录。进入后请尽快改成自己的：

- 进入 **设置 → 密码设置**（需先用管理员密码开启管理员模式）。
- **进入密码**建议填你们在一起的日期（月日，例如 12 月 23 日就填 `1223`），它就是打开 app 时输入的数字密码。
- **管理员密码**自己设置。
- 修改后立即生效，关机重开也用新密码。

技术说明：桌面版不依赖 `.env.local`。首次启动时 Electron 会在用户数据目录创建本地认证配置 `auth.local.json`，保存这两个密码；`AUTH_COOKIE_SECRET` 会随机生成并存在同一文件里。在设置页改密码会直接写回这个文件。若启动环境显式设置了 `SITE_PASSWORD`、`ADMIN_PASSWORD` 或 `AUTH_COOKIE_SECRET`，则优先使用环境变量。

## 安装与首次打开（给使用者）

本应用是个人/开源分发，**没有做苹果付费签名和公证**，所以从网上下载后第一次打开会被系统拦一下。这是正常现象，按下面操作放行即可，**只需要做一次**，之后正常双击打开。

### macOS

1. 双击 `Map For Everyone-0.1.0-arm64.dmg`，把里面的 **Map For Everyone** 拖进「应用程序」。
2. 在「应用程序」里 **右键点 Map For Everyone → 打开**，弹窗里再点一次 **打开**。
3. 若新版 macOS 没有「打开」选项：打开 **系统设置 → 隐私与安全性**，往下找到关于 Map For Everyone 的提示，点 **仍要打开**。
4. 若提示 **「已损坏，应移到废纸篓」**：打开「终端」运行下面这句去掉隔离标记，然后再打开：

   ```bash
   xattr -cr "/Applications/Map For Everyone.app"
   ```

### Windows

1. 运行 `Map For Everyone-0.1.0-x64-Setup.exe` 安装。
2. 若出现蓝色 **SmartScreen** 提示：点 **更多信息 → 仍要运行**。





## 桌面打包

生成 Next.js standalone 生产产物：

```bash
npm run desktop:prepare
```

生成未压缩的 macOS app，用于快速验证：

```bash
npm run dist:dir
```

生成 macOS 安装包：

```bash
npm run dist:mac
```

产物示例：

```text
dist/mac-arm64/Map For Everyone.app
dist/Map For Everyone-0.1.0-arm64.dmg
```

生成 Windows x64 安装包：

```bash
npm run dist:win
```

产物示例：

```text
dist/win-unpacked/Map For Everyone.exe
dist/Map For Everyone-0.1.0-x64-Setup.exe
```

在 macOS 上可以生成 Windows 安装包，但不能完整验证 Windows 运行效果；最终发布前建议在 Windows 真机或 CI 上再安装运行一次。

当前打包未配置正式应用图标、Apple 开发者签名和公证。macOS 产物使用 ad-hoc signing，公开分发前需要配置证书、公证和图标。


## 数据保存位置

浏览器开发模式默认写入项目目录：

```text
data/localMemories.private.json
data/cityAssets.private.json
data/loginPhotos.private.json
```

桌面打包版写入 Electron `userData/data`。常见位置：

```text
macOS: ~/Library/Application Support/Map For Everyone/data
Windows: %APPDATA%/Map For Everyone/data
```

可用环境变量覆盖桌面数据目录：

```text
MAP_OF_US_DATA_DIR=/path/to/data
```

打包版会强制启用本地文件存储：

```text
MAP_OF_US_STORAGE_MODE=local
MAP_OF_US_DESKTOP=1
```

因此即使 `NODE_ENV=production`，新增、编辑、删除和导入回忆也不会要求 Supabase。

## 可自定义内容

在设置页开启管理员模式后，可以自定义：

- 纪念日名称和开始日期。
- 首页“沿途天气”的城市。
- 右下角情侣 logo。
- 登录页九宫格照片。
- 登录页每张照片的城市名和标签文案。
- 城市地标图。

这些设置会随完整备份一起导出。登录页照片、城市地标和回忆照片以本地数据形式保存。

## 备份和迁移

在设置页使用“导出备份”保存完整备份文件。文件名会包含日期。

换电脑或重装后：

1. 安装并打开桌面应用。
2. 输入站点密码进入地图。
3. 进入设置页，用管理员密码开启管理员模式。
4. 导入备份文件。

导入会恢复回忆、城市地标、登录照片、纪念日、天气城市、logo，以及地点收藏、纪念日页面、时光宝盒等辅助数据。

```

## 目录速览

```text
app/                     App Router 页面和 API
components/              地图、入口页、回忆页和设置页组件
data/                    省份、城市、进度和浏览器侧数据工具
electron/                Electron 主进程入口
lib/                     地理数据、隐私模式和服务端存储工具
scripts/                 standalone 准备脚本
public/logo/             logo 占位图
public/photos/           默认照片素材
public/sprites/          城市地标、图标和像素素材
dist/                    本地打包产物
```

