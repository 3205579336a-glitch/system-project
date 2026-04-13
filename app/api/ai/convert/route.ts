import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "未上传文件" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // 建议在项目根目录手动创建 tmp 文件夹
    const tempDir = path.join(process.cwd(), 'tmp');
    
    await fs.mkdir(tempDir, { recursive: true });

    const timestamp = Date.now();
    const inputPath = path.join(tempDir, `conv_${timestamp}_${file.name}`);
    const outputDir = tempDir;

    // 写入临时文件
    await fs.writeFile(inputPath, buffer);

    // 使用 LibreOffice 进行 headless 转换
    // 注意：服务器必须安装了 libreoffice (如: sudo apt-get install libreoffice)
    try {
      // 这里的命令针对 Linux/macOS，Windows 可能需要指定 soffice.exe 的完整路径
      await execPromise(`soffice --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`);
    } catch (err: any) {
      console.error("LibreOffice 转换失败:", err.message);
      throw new Error("服务器转换引擎未就绪，请确保服务器已安装 LibreOffice");
    }

    // 获取生成的 PDF 路径
    const pdfPath = inputPath.replace(path.extname(inputPath), '.pdf');
    const pdfBuffer = await fs.readFile(pdfPath);

    // 清理临时文件
    await fs.unlink(inputPath);
    await fs.unlink(pdfPath);

    // 返回 PDF 二进制流
    return new Response(pdfBuffer, {
      headers: { 
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="converted.pdf"'
      },
    });

  } catch (error: any) {
    console.error('🔥 [Convert Error]:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}