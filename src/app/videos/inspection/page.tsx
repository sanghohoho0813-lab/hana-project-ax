import { redirect } from "next/navigation";

/** 실사용 영상은 '실사 시연' 화면으로 합쳤다 */
export default function InspectionVideoPage() {
  redirect("/demo#video");
}
