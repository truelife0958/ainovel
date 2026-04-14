import { redirect } from "next/navigation";

export default function OutlinePage() {
  redirect("/workspace?type=outline");
}
