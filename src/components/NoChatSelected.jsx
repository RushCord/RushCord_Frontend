import { Hash, Pencil } from "lucide-react";

const NoChatSelected = () => {
  return (
    <div className="flex w-full flex-1 items-center justify-center bg-[#313338] p-8">
      <div className="max-w-2xl px-8 py-10 text-left">
        <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-[#1e1f22] text-[#dbdee1]">
          <Hash className="size-8" />
        </div>
        <h2 className="text-4xl font-bold text-white">
          Chào mừng bạn đến với #ghi-chú-tài-nguyên!
        </h2>
        <p className="mt-3 text-[15px] text-[#949ba4]">
          Đây là sự khởi đầu của kênh #ghi-chú-tài-nguyên.
        </p>
        <button
          type="button"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#4e5058] px-3 py-2 text-sm font-medium text-[#dbdee1] hover:bg-[#5f626d]"
        >
          <Pencil className="size-4" />
          Chỉnh sửa kênh
        </button>
      </div>
    </div>
  );
};

export default NoChatSelected;
