"use client";

import { VideoPage } from "@/components/VideoPage";
import { VIDEOS } from "@/lib/videos";

export default function InspectionVideoPage() {
  return (
    <VideoPage
      video={VIDEOS.inspection}
      intro="실사(현장 확인) 때 시스템을 소개하는 영상입니다."
    />
  );
}
