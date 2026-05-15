"use client";

type DeleteMatchButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function DeleteMatchButton({ action }: DeleteMatchButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("정말 삭제하시겠습니까?")) {
          event.preventDefault();
        }
      }}
    >
      <button className="rounded-md border border-red-400/40 px-3 py-2 text-sm font-bold text-red-200 transition hover:bg-red-500/10" type="submit">
        삭제
      </button>
    </form>
  );
}
