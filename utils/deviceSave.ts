import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isMobileStaticApp } from "@/lib/client/idb";

/**
 * Saves a generated base64 image (PNG/JPEG) to the user's mobile photo album / device storage,
 * or triggers a browser download on desktop.
 */
export async function saveImageToPhotoAlbum(
  dataUrl: string,
  fileName: string
): Promise<{ success: boolean; message: string }> {
  if (isMobileStaticApp()) {
    try {
      const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

      // 1. Write the image file to mobile cache directory
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      // 2. Invoke native Share / Save dialog so user can save directly to photo gallery / WeChat / files
      try {
        await Share.share({
          title: "保存到相册或分享",
          text: "保存我们的回忆足迹卡片",
          url: savedFile.uri,
          dialogTitle: "保存或分享足迹卡片",
        });
        return { success: true, message: "已拉起保存菜单，可直接存入手机相册！" };
      } catch (shareErr) {
        // If native share was dismissed or not supported, try writing directly to Documents/Pictures
        try {
          await Filesystem.writeFile({
            path: `Pictures/${fileName}`,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true,
          });
          return { success: true, message: "已成功保存到手机相册文件目录！" };
        } catch {
          return { success: true, message: "已生成纪念卡片！" };
        }
      }
    } catch (err) {
      console.error("[saveImageToPhotoAlbum] Native save failed:", err);
    }
  }

  // 3. Web browser standard anchor download fallback
  try {
    const link = document.createElement("a");
    link.download = fileName;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { success: true, message: "已成功开始下载！" };
  } catch (err) {
    console.error("[saveImageToPhotoAlbum] Web download failed:", err);
    return { success: false, message: "保存失败，请截屏保存" };
  }
}
