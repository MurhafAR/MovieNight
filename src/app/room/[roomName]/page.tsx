import RoomPage from "@/components/Pages/RoomPage";
import { getRoomByNameAction } from "@/app/backend/actions";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ roomName: string }>;
}) {
  const { roomName } = await params;

  const roomData = await getRoomByNameAction(roomName);

  if (!roomData) {
    notFound();
  }

  return <RoomPage roomData={roomData} />;
}
