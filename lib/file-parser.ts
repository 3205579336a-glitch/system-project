import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// 设置 PDF.js Worker
// 注意：在 Next.js 中，通常建议使用 CDN 或从 public 目录加载 worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export const extractTextFromFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  try {
    switch (extension) {
      case 'pdf':
        return await parsePDF(file);
      case 'docx':
        return await parseWord(file);
      case 'pptx':
        return await parsePPTX(file);
      case 'txt':
      case 'md':
        return await file.text();
      default:
        throw new Error("不支持的文件格式，目前支持 PDF, DOCX, PPTX, TXT");
    }
  } catch (error) {
    console.error(`解析文件 ${file.name} 失败:`, error);
    throw error;
  }
};

const parsePDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
};

const parseWord = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

/**
 * PPTX 解析逻辑
 * PPTX 实际上是一个 ZIP 包，幻灯片文本存储在 ppt/slides/slide[n].xml 中
 */
const parsePPTX = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  let fullText = '';

  // 获取所有幻灯片文件路径
  const slideFiles = Object.keys(zip.files).filter(name => 
    name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
  );

  // 排序，确保按幻灯片顺序提取
 slideFiles.sort((a, b) => {
    // 修正语法错误：使用 ?.[0] 访问可选链数组索引
    const numA = parseInt(a.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });
  for (const slidePath of slideFiles) {
    const content = await zip.file(slidePath)?.async('string');
    if (content) {
      // 使用简单的正则提取 <a:t> 标签中的文本内容
      const textNodes = content.match(/<a:t>(.*?)<\/a:t>/g);
      if (textNodes) {
        const slideText = textNodes
          .map(node => node.replace(/<\/?a:t>/g, ''))
          .join(' ');
        fullText += `[Slide] ${slideText}\n`;
      }
    }
  }

  if (!fullText.trim()) throw new Error("PPTX 文件中未提取到有效文本内容");
  return fullText;
};