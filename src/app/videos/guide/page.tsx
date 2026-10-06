"use client";

import { VideoPage } from "@/components/VideoPage";
import { VIDEOS } from "@/lib/videos";

export default function GuideVideoPage() {
  return (
    <VideoPage
      video={VIDEOS.guide}
      intro="대표님과 이사님께 MVP를 어떻게 쓰게 되는지 안내하는 사용법 영상입니다."
    />
  );
}
