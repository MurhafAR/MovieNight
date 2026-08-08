import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        const cleanFileName = file.name
            .replace(/\s+/g, "_")
            .replace(/[^a-zA-Z0-9_.-]/g, "");

        const filePath = path.join(uploadDir, cleanFileName);
        await writeFile(filePath, buffer);

        const localVideoUrl = `/api/watch/${encodeURIComponent(cleanFileName)}`;

        console.log(`Movie saved at disk path: ${filePath}`);
        return NextResponse.json({ url: localVideoUrl });

    } catch (error) {
        console.error("Upload route exploded:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}