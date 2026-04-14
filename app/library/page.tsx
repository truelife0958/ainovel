import { redirect } from "next/navigation";

export default function LibraryPage() {
  redirect("/workspace?type=setting");
}
