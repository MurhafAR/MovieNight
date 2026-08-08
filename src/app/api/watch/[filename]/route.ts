import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".m4v": "video/mp4",
    ".ts": "video/mp2t",
    ".3gp": "video/3gpp",
    ".wmv": "video/x-ms-wmv",
    ".flv": "video/x-flv",
};

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || "video/mp4";
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ filename: string }> }) {
    try {

        const resolvedParams = await params;

        const decodedName = decodeURIComponent(resolvedParams.filename);
        const safeFilename = decodedName
            .replace(/\s+/g, "_")
            .replace(/[^a-zA-Z0-9_.-]/g, "");

        let filePath = path.join(process.cwd(), "public", "uploads", safeFilename);

        // If it doesn't exist at the root level, look inside the src folder
        if (!fs.existsSync(filePath)) {
            filePath = path.join(process.cwd(), "src", "public", "uploads", safeFilename);
        }

        console.log(`🔍 Server is checking filesystem path: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            return new NextResponse("Video not found", { status: 404 });
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.get("range");
        const contentType = getMimeType(filePath);

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            const file = fs.createReadStream(filePath, { start, end });
            const head: Record<string, string> = {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": String(chunksize),
                "Content-Type": contentType,
            };

            return new NextResponse(Readable.toWeb(file) as ReadableStream, { status: 206, headers: head });
        } else {
            const file = fs.createReadStream(filePath);
            const head: Record<string, string> = {
                "Content-Length": String(fileSize),
                "Content-Type": contentType,
            };
            return new NextResponse(Readable.toWeb(file) as ReadableStream, { status: 200, headers: head });
        }
    } catch (err) {
        console.error("Watch route exception:", err);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}