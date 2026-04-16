import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [{ title: "Hello" }];
};

export default function Index() {
  return (
    <main>
      <h1>hello</h1>
    </main>
  );
}
