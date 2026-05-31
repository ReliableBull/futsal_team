"use client";

type DeletePosterButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function DeletePosterButton({ action }: DeletePosterButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("이 포스터를 삭제하시겠습니까?")) {
          event.preventDefault();
        }
      }}
    >
      <button className="w-full rounded-md border border-red-400/40 px-3 py-2 text-sm font-bold text-red-200 transition hover:bg-red-500/10" type="submit">
        포스터 삭제
      </button>
    </form>
  );
}
