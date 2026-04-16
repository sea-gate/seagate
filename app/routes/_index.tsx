import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [{ title: "Hello Preston" }];
};

export default function Index() {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        margin: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes fly {
          0%   { transform: translate(-40vw, -30vh) rotate(0deg); }
          20%  { transform: translate( 40vw, -25vh) rotate(20deg); }
          40%  { transform: translate( 45vw,  30vh) rotate(-15deg); }
          60%  { transform: translate(  0vw,  40vh) rotate(10deg); }
          80%  { transform: translate(-45vw,  20vh) rotate(-20deg); }
          100% { transform: translate(-40vw, -30vh) rotate(0deg); }
        }
        .surfer {
          position: absolute;
          top: 50%;
          left: 50%;
          font-size: 4rem;
          animation: fly 8s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>
      <h1 style={{ fontSize: "3rem", margin: 0 }}>hello preston</h1>
      <span className="surfer" role="img" aria-label="surfer">
        🏄
      </span>
    </main>
  );
}
