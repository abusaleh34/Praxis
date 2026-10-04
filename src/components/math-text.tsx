/** Keep numbers and degree symbols together inside Arabic prose. */
export function MathText({ children }: { children: string }) {
  const parts = children.split(/(\d+(?:\.\d+)?[°²]?)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\d/.test(part) ? (
          <bdi key={i} dir="ltr">
            {part}
          </bdi>
        ) : (
          part
        ),
      )}
    </>
  );
}
