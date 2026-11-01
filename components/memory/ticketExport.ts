import { type Memory, moodConfig } from "@/data/memories";
import { type City } from "@/data/cities";
import { saveImageToPhotoAlbum } from "@/utils/deviceSave";

// Wrap canvas text into multiple lines
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export async function exportTicketAsImage(params: {
  memory: Memory;
  photoUrl: string;
  cityName: string;
  city?: City;
}): Promise<void> {
  const { memory, photoUrl, cityName, city } = params;

  const width = 1200;
  const height = 640;
  const dividerX = 890;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Coordinate text formatting
  const gpsString =
    city && typeof city.lng === "number" && typeof city.lat === "number"
      ? `${city.lng.toFixed(2)}°E, ${city.lat.toFixed(2)}°N`
      : "";
  const coordinateLabel = gpsString ? `${cityName} (${gpsString})` : cityName;

  // 1. Base card background
  ctx.fillStyle = "#FAF8F2";
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 20);
  ctx.fill();

  // Fine card border
  ctx.strokeStyle = "#D8DDD8";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle paper texture grain effect
  ctx.fillStyle = "rgba(90, 102, 112, 0.02)";
  for (let i = 0; i < width; i += 4) {
    for (let j = 0; j < height; j += 4) {
      if ((i + j) % 7 === 0) {
        ctx.fillRect(i, j, 2, 2);
      }
    }
  }

  // 2. Perforation divider and notch cutouts
  const notchRadius = 24;

  // Top notch
  ctx.fillStyle = "#FAFBF7";
  ctx.beginPath();
  ctx.arc(dividerX, 0, notchRadius, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = "#D8DDD8";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bottom notch
  ctx.fillStyle = "#FAFBF7";
  ctx.beginPath();
  ctx.arc(dividerX, height, notchRadius, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "#D8DDD8";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dashed perforation line
  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = "#D8DDD8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dividerX, notchRadius + 4);
  ctx.lineTo(dividerX, height - notchRadius - 4);
  ctx.stroke();
  ctx.restore();

  // 3. Header area (Main ticket)
  ctx.fillStyle = "#F5DCE0";
  ctx.beginPath();
  ctx.roundRect(44, 34, 30, 30, 8);
  ctx.fill();

  ctx.fillStyle = "#E86F82";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("♥", 52, 55);

  ctx.fillStyle = "#5A6670";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("MAP FOR LOVE CINEMA · 恋爱放映厅", 88, 55);

  ctx.fillStyle = "rgba(90, 102, 112, 0.45)";
  ctx.font = "14px monospace";
  const serialNo = `NO. ${memory.date.replace(/\./g, "")}-${memory.id.slice(0, 4).toUpperCase()}`;
  ctx.fillText(serialNo, 620, 55);

  // 4. Movie Poster / Photo frame
  const photoX = 44;
  const photoY = 90;
  const photoW = 380;
  const photoH = 490;

  // Photo outer frame (Polaroid/Film card style)
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(photoX, photoY, photoW, photoH, 12);
  ctx.fill();
  ctx.strokeStyle = "#E4E8E4";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Try loading and drawing the photo
  const imgInnerW = photoW - 24;
  const imgInnerH = photoH - 60;
  const imgInnerX = photoX + 12;
  const imgInnerY = photoY + 12;

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = photoUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // Continue even if image load fails
    });

    if (img.width > 0 && img.height > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(imgInnerX, imgInnerY, imgInnerW, imgInnerH, 8);
      ctx.clip();

      // Object-cover crop
      const imgRatio = img.width / img.height;
      const targetRatio = imgInnerW / imgInnerH;
      let sX = 0, sY = 0, sW = img.width, sH = img.height;
      if (imgRatio > targetRatio) {
        sW = img.height * targetRatio;
        sX = (img.width - sW) / 2;
      } else {
        sH = img.width / targetRatio;
        sY = (img.height - sH) / 2;
      }

      ctx.drawImage(img, sX, sY, sW, sH, imgInnerX, imgInnerY, imgInnerW, imgInnerH);
      ctx.restore();
    } else {
      // Fallback placeholder
      ctx.fillStyle = "#EAEFEA";
      ctx.beginPath();
      ctx.roundRect(imgInnerX, imgInnerY, imgInnerW, imgInnerH, 8);
      ctx.fill();
      ctx.fillStyle = "#5A6670";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("📷 我们的独家剧照", imgInnerX + imgInnerW / 2, imgInnerY + imgInnerH / 2);
      ctx.textAlign = "left";
    }
  } catch {
    // Graceful fallback
  }

  // Label under photo inside frame
  ctx.fillStyle = "#5A6670";
  ctx.font = "italic 13px sans-serif";
  ctx.fillText(`STILL PHOTO · 《${cityName}篇》`, imgInnerX + 4, photoY + photoH - 20);

  // 5. Film Details (Right side of Main Ticket)
  const infoX = 460;

  // Title
  const title = `《 ${cityName} · ${memory.text.slice(0, 10).trim() || "两人的心动足迹"} 》`;
  ctx.fillStyle = "#3F4951";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(title, infoX, 130);

  // English / GPS coordinate subtitle
  ctx.fillStyle = "#E86F82";
  ctx.font = "bold 13px sans-serif";
  const subtitleGps = gpsString ? `GPS: ${gpsString}` : `LOCATION: ${cityName}`;
  ctx.fillText(`${subtitleGps} · ROMANTIC ARCHIVE`, infoX, 160);

  // Separator line
  ctx.strokeStyle = "#E8ECE8";
  ctx.beginPath();
  ctx.moveTo(infoX, 178);
  ctx.lineTo(dividerX - 44, 178);
  ctx.stroke();

  // Key-value metadata table
  const metaStartY = 215;
  const lineHeight = 34;

  const metadata = [
    { label: "放映时间", val: memory.date || "美好未央" },
    { label: "打卡坐标", val: coordinateLabel },
    { label: "专属影厅", val: "心动双人厅 · 05排20座 (情侣VIP)" },
    {
      label: "心动指数",
      val: memory.mood && moodConfig[memory.mood]
        ? `${moodConfig[memory.mood].emoji} ${moodConfig[memory.mood].label}`
        : "🥰 浪漫满分",
    },
  ];

  metadata.forEach((item, index) => {
    const y = metaStartY + index * lineHeight;
    ctx.fillStyle = "rgba(90, 102, 112, 0.6)";
    ctx.font = "14px sans-serif";
    ctx.fillText(item.label + " :", infoX, y);

    ctx.fillStyle = "#3F4951";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(item.val, infoX + 85, y);
  });

  // Story / Synopsis Quotation box
  const quoteY = 375;
  const quoteW = dividerX - 44 - infoX;

  ctx.fillStyle = "#FAF5EE";
  ctx.beginPath();
  ctx.roundRect(infoX, quoteY, quoteW, 110, 8);
  ctx.fill();
  ctx.strokeStyle = "#EADFCF";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#E86F82";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("经典对白 / 剧情简介 :", infoX + 16, quoteY + 28);

  ctx.fillStyle = "#5A6670";
  ctx.font = "14px sans-serif";
  const quoteText = `“ ${memory.text || "把平淡的岁月，过成两个人热气腾腾的电影。"} ”`;
  const wrappedLines = wrapText(ctx, quoteText, quoteW - 32);
  wrappedLines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, infoX + 16, quoteY + 54 + i * 22);
  });

  // Vintage Mood Stamp (Circle with star)
  const stampX = 770;
  const stampY = 525;
  ctx.save();
  ctx.translate(stampX, stampY);
  ctx.rotate(-0.15); // -8.5 degrees

  // Stamp circle
  ctx.strokeStyle = "rgba(216, 111, 130, 0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.stroke();

  // Inner dashed circle
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.stroke();

  // Stamp texts
  ctx.fillStyle = "rgba(216, 111, 130, 0.9)";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("★ 独家放映 ★", 0, -18);

  const stampMood = memory.mood && moodConfig[memory.mood] ? moodConfig[memory.mood].label : "甜蜜回忆";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(stampMood, 0, 2);

  ctx.font = "10px sans-serif";
  ctx.fillText("SPECIAL EDITION", 0, 20);
  ctx.restore();

  // 6. Stub Section (Right of divider, x = 890 to 1200)
  const stubX = dividerX + 32;
  const stubW = width - dividerX - 64;

  ctx.fillStyle = "#E86F82";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("ADMIT TWO · 两人入席", stubX, 55);

  ctx.fillStyle = "#3F4951";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(cityName, stubX, 95);

  ctx.fillStyle = "rgba(90, 102, 112, 0.65)";
  ctx.font = "13px sans-serif";
  ctx.fillText(`日期: ${memory.date}`, stubX, 125);
  ctx.fillText("席位: VIP 情侣席", stubX, 150);
  ctx.fillText("场次: 甜蜜专属场", stubX, 175);

  // Price box
  ctx.fillStyle = "#FAF5EE";
  ctx.beginPath();
  ctx.roundRect(stubX, 200, stubW, 46, 6);
  ctx.fill();
  ctx.strokeStyle = "#EADFCF";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#E86F82";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("PRICE: 无价 / PRICELESS", stubX + 12, 228);

  // Barcode decoration
  const barcodeY = 320;
  const barcodeH = 120;
  ctx.fillStyle = "#3F4951";

  // Pseudo-random but deterministic barcode bars based on memory id
  let barOffset = 0;
  const seedStr = memory.id + memory.date + "ticket";
  for (let i = 0; i < 46; i++) {
    const charCode = seedStr.charCodeAt(i % seedStr.length);
    const barW = (charCode % 3) + 1.5;
    const spaceW = ((charCode >> 1) % 4) + 2.5;
    if (barOffset + barW > stubW) break;
    ctx.fillRect(stubX + barOffset, barcodeY, barW, barcodeH);
    barOffset += barW + spaceW;
  }

  // Barcode number
  ctx.fillStyle = "rgba(90, 102, 112, 0.7)";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`5 2 0 1 3 1 4  ${memory.date.slice(0, 4)}`, stubX + stubW / 2, barcodeY + barcodeH + 24);

  // Heart watermark at the bottom of stub
  ctx.fillStyle = "rgba(245, 220, 224, 0.7)";
  ctx.font = "34px sans-serif";
  ctx.fillText("♥", stubX + stubW / 2, height - 36);

  // 7. Convert canvas to PNG and save to photo album / trigger download
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const fileName = `电影票根-${cityName}-${memory.date || "回忆"}.png`;
    await saveImageToPhotoAlbum(dataUrl, fileName);
  } catch (error) {
    console.error("Export ticket error:", error);
  }
}
