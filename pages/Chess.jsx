import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
//  BUILT-IN CHESS ENGINE
// ─────────────────────────────────────────────────────────────
const FILES = ["a","b","c","d","e","f","g","h"];
// White pieces rendered as filled black symbols on light background (CSS invert trick)
// We render all pieces as filled black unicode, then color via CSS
const PIECE_UNICODE = {
  K:"♚", Q:"♛", R:"♜", B:"♝", N:"♞", P:"♟",
  k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟",
};
// White uses the same filled glyphs but colored white with black outline via text-shadow
const WHITE_STYLE = {
  color: "#ffffff",
  textShadow: "-1px -1px 0 #222, 1px -1px 0 #222, -1px 1px 0 #222, 1px 1px 0 #222, 0 0 3px rgba(0,0,0,0.6)",
  filter: "none",
};
const BLACK_STYLE = {
  color: "#111111",
  textShadow: "0 1px 3px rgba(0,0,0,0.4)",
  filter: "none",
};
const RATINGS = [
  { label:"Beginner",     elo:400,  depth:1, rand:0.9  },
  { label:"Casual",       elo:800,  depth:2, rand:0.5  },
  { label:"Intermediate", elo:1200, depth:2, rand:0.2  },
  { label:"Advanced",     elo:1600, depth:3, rand:0.1  },
  { label:"Expert",       elo:2000, depth:3, rand:0.02 },
  { label:"Master",       elo:2500, depth:4, rand:0    },
];
const VALS = { p:100, n:320, b:330, r:500, q:900, k:20000 };
const PST = {
  p:[ 0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  b:[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  r:[0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
  q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  k:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20],
};

function emptyBoard() { return Array.from({length:8},()=>Array(8).fill(null)); }
function startBoard() {
  const b=emptyBoard(), br=["r","n","b","q","k","b","n","r"];
  for(let f=0;f<8;f++){b[0][f]={type:br[f],color:"b"};b[1][f]={type:"p",color:"b"};b[6][f]={type:"p",color:"w"};b[7][f]={type:br[f],color:"w"};}
  return b;
}
function cloneBoard(b){return b.map(r=>r.map(c=>c?{...c}:null));}
function sqName(r,f){return FILES[f]+(8-r);}
function inBounds(r,f){return r>=0&&r<8&&f>=0&&f<8;}

function rawMoves(board,r,f,state){
  const piece=board[r][f]; if(!piece)return[];
  const{type,color}=piece, opp=color==="w"?"b":"w", moves=[];
  const add=(tr,tf,extra={})=>{if(!inBounds(tr,tf))return;const t=board[tr][tf];if(t&&t.color===color)return;moves.push({from:[r,f],to:[tr,tf],...extra});};
  const slide=(dirs)=>{for(const[dr,df]of dirs){let tr=r+dr,tf=f+df;while(inBounds(tr,tf)){const t=board[tr][tf];if(t){if(t.color===opp)moves.push({from:[r,f],to:[tr,tf]});break;}moves.push({from:[r,f],to:[tr,tf]});tr+=dr;tf+=df;}}};
  if(type==="p"){
    const dir=color==="w"?-1:1,startRow=color==="w"?6:1,promRow=color==="w"?0:7;
    if(inBounds(r+dir,f)&&!board[r+dir][f]){
      if((r+dir)===promRow){for(const p of["q","r","b","n"])moves.push({from:[r,f],to:[r+dir,f],promo:p});}
      else{moves.push({from:[r,f],to:[r+dir,f]});if(r===startRow&&!board[r+2*dir][f])moves.push({from:[r,f],to:[r+2*dir,f]});}
    }
    for(const df of[-1,1]){const tr=r+dir,tf=f+df;if(!inBounds(tr,tf))continue;if(board[tr][tf]&&board[tr][tf].color===opp){if(tr===promRow){for(const p of["q","r","b","n"])moves.push({from:[r,f],to:[tr,tf],promo:p});}else moves.push({from:[r,f],to:[tr,tf]});}if(state.ep&&sqName(tr,tf)===state.ep)moves.push({from:[r,f],to:[tr,tf],ep:true});}
  }else if(type==="n"){for(const[dr,df]of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])add(r+dr,f+df);}
  else if(type==="b")slide([[-1,-1],[-1,1],[1,-1],[1,1]]);
  else if(type==="r")slide([[-1,0],[1,0],[0,-1],[0,1]]);
  else if(type==="q")slide([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
  else if(type==="k"){
    for(const[dr,df]of[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])add(r+dr,f+df);
    const crow=color==="w"?7:0;
    if(r===crow&&f===4){
      if(state.castle.includes(color==="w"?"K":"k")&&!board[crow][5]&&!board[crow][6])moves.push({from:[r,f],to:[crow,6],castle:"k"});
      if(state.castle.includes(color==="w"?"Q":"q")&&!board[crow][3]&&!board[crow][2]&&!board[crow][1])moves.push({from:[r,f],to:[crow,2],castle:"q"});
    }
  }
  return moves;
}
function findKing(board,color){for(let r=0;r<8;r++)for(let f=0;f<8;f++)if(board[r][f]?.type==="k"&&board[r][f]?.color===color)return[r,f];return null;}
function isAttacked(board,r,f,byColor,state={castle:"",ep:null}){
  for(let sr=0;sr<8;sr++)for(let sf=0;sf<8;sf++){if(board[sr][sf]?.color!==byColor)continue;if(rawMoves(board,sr,sf,state).some(m=>m.to[0]===r&&m.to[1]===f))return true;}return false;
}
function applyMove(board,move,state){
  const nb=cloneBoard(board),[fr,ff]=move.from,[tr,tf]=move.to,piece=nb[fr][ff];
  nb[tr][tf]=move.promo?{type:move.promo,color:piece.color}:piece; nb[fr][ff]=null;
  if(move.ep){const epDir=piece.color==="w"?1:-1;nb[tr+epDir][tf]=null;}
  if(move.castle==="k"){nb[fr][5]=nb[fr][7];nb[fr][7]=null;}
  if(move.castle==="q"){nb[fr][3]=nb[fr][0];nb[fr][0]=null;}
  const ns={castle:state.castle,ep:null,turn:state.turn==="w"?"b":"w"};
  if(piece.type==="p"&&Math.abs(tr-fr)===2)ns.ep=sqName((fr+tr)/2,ff);
  if(piece.type==="k")ns.castle=ns.castle.replace(piece.color==="w"?"K":"k","").replace(piece.color==="w"?"Q":"q","");
  if(piece.type==="r"){if(ff===0)ns.castle=ns.castle.replace(piece.color==="w"?"Q":"q","");if(ff===7)ns.castle=ns.castle.replace(piece.color==="w"?"K":"k","");}
  return{board:nb,state:ns};
}
function legalMovesFor(board,color,state){
  const moves=[];
  for(let r=0;r<8;r++)for(let f=0;f<8;f++){
    if(board[r][f]?.color!==color)continue;
    for(const m of rawMoves(board,r,f,state)){const{board:nb}=applyMove(board,m,state);const kPos=findKing(nb,color);if(kPos&&!isAttacked(nb,kPos[0],kPos[1],color==="w"?"b":"w",state))moves.push(m);}
  }
  return moves;
}
function evaluate(board){
  let score=0;
  for(let r=0;r<8;r++)for(let f=0;f<8;f++){const p=board[r][f];if(!p)continue;const idx=(p.color==="w"?r:7-r)*8+f;score+=(p.color==="w"?1:-1)*(VALS[p.type]+(PST[p.type]?.[idx]||0));}
  return score;
}
function minimax(board,state,depth,alpha,beta,maximizing){
  const color=state.turn,moves=legalMovesFor(board,color,state);
  if(moves.length===0){const kPos=findKing(board,color);if(kPos&&isAttacked(board,kPos[0],kPos[1],color==="w"?"b":"w",state))return maximizing?-99999:99999;return 0;}
  if(depth===0)return evaluate(board);
  if(maximizing){let best=-Infinity;for(const m of moves){const{board:nb,state:ns}=applyMove(board,m,state);best=Math.max(best,minimax(nb,ns,depth-1,alpha,beta,false));alpha=Math.max(alpha,best);if(beta<=alpha)break;}return best;}
  else{let best=Infinity;for(const m of moves){const{board:nb,state:ns}=applyMove(board,m,state);best=Math.min(best,minimax(nb,ns,depth-1,alpha,beta,true));beta=Math.min(beta,best);if(beta<=alpha)break;}return best;}
}
function getBotMove(board,state,depth,rand){
  const moves=legalMovesFor(board,"b",state);if(!moves.length)return null;
  if(rand>0&&Math.random()<rand)return moves[Math.floor(Math.random()*moves.length)];
  let best=-Infinity,bestMove=null;
  for(const m of moves){const{board:nb,state:ns}=applyMove(board,m,state);const score=minimax(nb,ns,depth-1,-Infinity,Infinity,true);if(score>best){best=score;bestMove=m;}}
  return bestMove||moves[0];
}

// ─────────────────────────────────────────────────────────────
//  SOUNDS via Web Audio API (no CDN)
// ─────────────────────────────────────────────────────────────
function createAudioCtx() {
  try { return new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
}
let _audioCtx = null;
function getAudioCtx() { if (!_audioCtx) _audioCtx = createAudioCtx(); return _audioCtx; }

function playMove() {
  const ctx = getAudioCtx(); if (!ctx) return;
  // Short woody "clack" — noise burst + resonant filter
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(ctx.sampleRate*0.015));
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass"; filter.frequency.value = 1800; filter.Q.value = 2.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.55, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  src.start(); src.stop(ctx.currentTime + 0.12);
}

function playCapture() {
  const ctx = getAudioCtx(); if (!ctx) return;
  // Deeper thud + click
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(ctx.sampleRate*0.02));
  const src = ctx.createBufferSource(); src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass"; filter.frequency.value = 900; filter.Q.value = 1.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.75, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  src.start(); src.stop(ctx.currentTime + 0.18);
  // second click layer
  setTimeout(() => {
    const ctx2 = getAudioCtx();
    const osc = ctx2.createOscillator(); osc.frequency.value = 220; osc.type = "triangle";
    const g2 = ctx2.createGain();
    g2.gain.setValueAtTime(0.3, ctx2.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.06);
    osc.connect(g2); g2.connect(ctx2.destination);
    osc.start(); osc.stop(ctx2.currentTime + 0.06);
  }, 18);
}

// ─────────────────────────────────────────────────────────────
//  REACT COMPONENT
// ─────────────────────────────────────────────────────────────
const SQUARE_SIZE = 70;
const initState = () => ({ castle:"KQkq", ep:null, turn:"w" });

export default function ChessApp({ onTimeUpdate, onBack }) {
  const [screen, setScreen] = useState("select");
  const [rating, setRating] = useState(null);
  const [board, setBoard] = useState(startBoard());
  const [gameState, setGameState] = useState(initState());
  const [selected, setSelected] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [status, setStatus] = useState("Your turn");
  const [gameOver, setGameOver] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef(null);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState([]);
  const [promotion, setPromotion] = useState(null);
  // animating piece: { piece, fromPx:{x,y}, toPx:{x,y}, key }
  const [animPiece, setAnimPiece] = useState(null);
  const boardRef = useRef(null);

  // ── Timer ──────────────────────────────────────────────────
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(() => parseInt(localStorage.getItem('chessTimer')||'0'));
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsed(e => {
          const next = e + 1;
          localStorage.setItem('chessTimer', String(next));
          if (onTimeUpdate) onTimeUpdate(next);
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };

  // ── Confetti ──────────────────────────────────────────────
  useEffect(() => {
    if (!showConfetti) return;
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({length:160}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: 8 + Math.random()*8,
      h: 5 + Math.random()*5,
      r: Math.random()*Math.PI*2,
      dr: (Math.random()-0.5)*0.2,
      dx: (Math.random()-0.5)*2,
      dy: 2.5 + Math.random()*3,
      color: ["#00d18c","#4e8ef7","#f7a94e","#f74e4e","#e8f0ed","#ffd700"][Math.floor(Math.random()*6)],
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      pieces.forEach(p => {
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
        ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
        p.x+=p.dx; p.y+=p.dy; p.r+=p.dr;
        if(p.y>canvas.height) { p.y=-10; p.x=Math.random()*canvas.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const t = setTimeout(() => { setShowConfetti(false); cancelAnimationFrame(raf); }, 4000);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [showConfetti]);

  // ── Sync persisted timer to dashboard on mount ──────────────
  useEffect(() => {
    const saved = parseInt(localStorage.getItem('chessTimer')||'0');
    if (onTimeUpdate && saved > 0) onTimeUpdate(saved);
  }, []);

  // ── Start game ─────────────────────────────────────────────
  const startGame = (r) => {
    setRating(r); setBoard(startBoard()); setGameState(initState());
    setSelected(null); setHighlights([]); setLastMove(null);
    setStatus("Your turn"); setGameOver(false); setThinking(false);
    setHistory([]); setPromotion(null); setAnimPiece(null);
    setScreen("game");
  };

  // ── Get px position of a square on the board ───────────────
  const squarePx = (rank, file) => ({
    x: file * SQUARE_SIZE + SQUARE_SIZE / 2,
    y: rank * SQUARE_SIZE + SQUARE_SIZE / 2,
  });

  // ── Animate then apply ─────────────────────────────────────
  const animateMove = (move, currentBoard, cb) => {
    const piece = currentBoard[move.from[0]][move.from[1]];
    if (!piece) { cb(); return; }
    const fromPx = squarePx(move.from[0], move.from[1]);
    const toPx   = squarePx(move.to[0],   move.to[1]);
    setAnimPiece({ piece, fromPx, toPx, key: Date.now() });
    setTimeout(() => { setAnimPiece(null); cb(); }, 180);
  };

  // ── Check game status ──────────────────────────────────────
  const getStatus = useCallback((b, st, botJustMoved) => {
    const color = st.turn;
    const moves = legalMovesFor(b, color, st);
    const kPos  = findKing(b, color);
    const inChk = kPos && isAttacked(b, kPos[0], kPos[1], color==="w"?"b":"w", st);
    if (moves.length===0) {
      if (inChk) return { text: color==="w" ? "Checkmate — you lose!" : "Checkmate — you win! 🎉", over:true, win: color!=="w" };
      return { text:"Stalemate — draw!", over:true, win:false };
    }
    if (inChk) return { text: color==="w" ? "You're in check!" : "Bot is in check!", over:false };
    return { text: botJustMoved ? "Your turn" : "Bot is thinking…", over:false };
  }, []);

  // ── Execute a move (player or bot) ────────────────────────
  const executeMove = useCallback((move, b, st, promoType, isBot=false) => {
    const finalMove = promoType ? {...move, promo:promoType} : move;
    const isCapture = !!b[move.to[0]][move.to[1]] || move.ep;

    animateMove(finalMove, b, () => {
      const { board:nb, state:ns } = applyMove(b, finalMove, st);
      setBoard(nb); setGameState(ns);
      setLastMove(finalMove);
      setSelected(null); setHighlights([]); setPromotion(null);

      // sound
      if (isCapture) playCapture(); else playMove();

      const san = (b[move.from[0]][move.from[1]]?.type !== "p"
        ? (b[move.from[0]][move.from[1]]?.type||"").toUpperCase() : "")
        + (isCapture ? "x" : "") + sqName(move.to[0], move.to[1])
        + (promoType ? "="+promoType.toUpperCase() : "");
      setHistory(prev => [...prev, san]);

      const { text, over, win } = getStatus(nb, ns, isBot);
      setStatus(text);
      if (over) { setGameOver(true); setTimerRunning(false); if (win) setShowConfetti(true); return; }

      if (!isBot) {
        // trigger bot
        setThinking(true);
        setTimeout(() => {
          const bm = getBotMove(nb, ns, rating.depth, rating.rand);
          if (!bm) { setThinking(false); return; }
          executeMove(bm, nb, ns, null, true);
          setThinking(false);
        }, 80);
      }
    });
  }, [rating, getStatus]);

  // ── Square click ───────────────────────────────────────────
  const handleClick = (r, f) => {
    if (gameOver || gameState.turn !== "w" || thinking || animPiece) return;
    const piece = board[r][f];
    if (selected) {
      const move = highlights.find(m => m.to[0]===r && m.to[1]===f);
      if (move) {
        if (board[selected[0]][selected[1]]?.type==="p" && r===0) {
          setPromotion({ move }); return;
        }
        executeMove(move, board, gameState);
        return;
      }
    }
    if (piece?.color==="w") {
      setSelected([r,f]);
      setHighlights(legalMovesFor(board,"w",gameState).filter(m=>m.from[0]===r&&m.from[1]===f));
    } else {
      setSelected(null); setHighlights([]);
    }
  };

  const isHighlighted = (r,f) => highlights.some(m=>m.to[0]===r&&m.to[1]===f);
  const isLastMove    = (r,f) => lastMove && ((lastMove.from[0]===r&&lastMove.from[1]===f)||(lastMove.to[0]===r&&lastMove.to[1]===f));
  const isSelected    = (r,f) => selected && selected[0]===r && selected[1]===f;

  const lightSq="#c8d8c0", darkSq="#4a7060";

  // ── Shared top bar ────────────────────────────────────────
  const TopBar = () => (
    <div style={{ width:"100%", background:"#0a0f0d", borderBottom:"1px solid #1a2e24", padding:"0 20px", height:52, display:"flex", alignItems:"center", gap:12, flexShrink:0, boxSizing:"border-box" }}>
      <button
        onClick={() => { if (screen === "game") setScreen("select"); else if (onBack) onBack(); }}
        style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#7a9e8e", borderRadius:8, padding:"5px 14px", cursor:"pointer", fontSize:13 }}>
        {screen === "game" ? "← Levels" : "← Apps"}
      </button>
      <div style={{ fontSize:14, fontWeight:700 }}>
        {screen==="game"
          ? <>{rating?.label} <span style={{ color:"#7a9e8e", fontWeight:400, fontSize:12 }}>~{rating?.elo} ELO</span></>
          : <span style={{ color:"#e8f0ed" }}>Chess vs Bot</span>
        }
      </div>
      <div style={{ flex:1 }}/>
      {/* Timer */}
      <div style={{ display:"flex", alignItems:"center", gap:8, background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:10, padding:"5px 14px" }}>
        <span style={{ fontSize:16, fontWeight:800, letterSpacing:"2px", color:elapsed>=1800?"#00d18c":"#e8f0ed", minWidth:54, textAlign:"center", fontVariantNumeric:"tabular-nums" }}>
          {formatTime(elapsed)}
        </span>
        <button onClick={()=>setTimerRunning(v=>!v)}
          style={{ background:timerRunning?"#f74e4e25":"#00d18c25", border:`1px solid ${timerRunning?"#f74e4e":"#00d18c"}`, borderRadius:6, padding:"3px 10px", cursor:"pointer", fontSize:12, fontWeight:700, color:timerRunning?"#f74e4e":"#00d18c" }}>
          {timerRunning?"⏸":"▶"}
        </button>
        <button onClick={()=>{ setTimerRunning(false); setElapsed(0); localStorage.setItem('chessTimer','0'); if(onTimeUpdate) onTimeUpdate(0); }}
          title="Reset timer"
          style={{ background:"none", border:"none", cursor:"pointer", padding:"3px 4px", display:"flex", alignItems:"center", color:"#4a7060" }}
          onMouseEnter={e=>e.currentTarget.style.color="#e8f0ed"}
          onMouseLeave={e=>e.currentTarget.style.color="#4a7060"}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
        </button>
      </div>
      {screen==="game" && (
        <button onClick={()=>startGame(rating)}
          style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#00d18c", borderRadius:8, padding:"5px 14px", cursor:"pointer", fontSize:13 }}>New Game</button>
      )}
    </div>
  );

  // ── Rating select ──────────────────────────────────────────
  if (screen==="select") return (
    <div style={{ minHeight:"100vh", background:"#111312", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column" }}>
      <TopBar />
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>
        <div style={{ fontSize:40, marginBottom:8 }}>♟️</div>
        <div style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>Chess vs Bot</div>
        <div style={{ fontSize:14, color:"#7a9e8e", marginBottom:36 }}>Pick your opponent's strength</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12, width:"100%", maxWidth:620 }}>
          {RATINGS.map(r=>(
            <button key={r.label} onClick={()=>startGame(r)}
              style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:14, padding:"20px 16px", cursor:"pointer", textAlign:"left", color:"#e8f0ed", transition:"border-color 0.15s" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#00d18c"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#1f2e28"}>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{r.label}</div>
              <div style={{ fontSize:13, color:"#00d18c", fontWeight:600 }}>~{r.elo} ELO</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Game screen ────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#111312", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", alignItems:"center" }}>

      <TopBar />

      {/* Status */}
      <div style={{ fontSize:13, fontWeight:600, margin:"10px 0 6px", height:18,
        color: gameOver?"#f74e4e": thinking?"#f7a94e":"#00d18c" }}>{status}</div>

      {/* Board */}
      <div ref={boardRef} style={{ position:"relative", borderRadius:4, overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,0.6)", border:"2px solid #1f2e28", flexShrink:0 }}>
        {board.map((row,rank)=>(
          <div key={rank} style={{ display:"flex" }}>
            {row.map((piece,file)=>{
              const light=(rank+file)%2===0;
              const sel=isSelected(rank,file), hl=isHighlighted(rank,file), lm=isLastMove(rank,file);
              let bg=light?lightSq:darkSq;
              if(sel) bg="rgba(255,220,0,0.65)";
              else if(lm) bg=light?"rgba(255,220,0,0.45)":"rgba(200,180,0,0.4)";
              // hide piece that is currently animating from its origin
              const isAnimFrom = animPiece && animPiece.fromPx.x===file*SQUARE_SIZE+SQUARE_SIZE/2 && animPiece.fromPx.y===rank*SQUARE_SIZE+SQUARE_SIZE/2;
              return (
                <div key={file} onClick={()=>handleClick(rank,file)}
                  style={{ width:SQUARE_SIZE, height:SQUARE_SIZE, background:bg, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", cursor:"pointer", userSelect:"none" }}>
                  {hl && !piece && <div style={{ width:18, height:18, borderRadius:"50%", background:"rgba(0,0,0,0.22)", pointerEvents:"none" }}/>}
                  {hl && piece  && <div style={{ position:"absolute", inset:0, border:"3px solid rgba(0,0,0,0.25)", pointerEvents:"none" }}/>}
                  {piece && !isAnimFrom && (
                    <span style={{ fontSize:44, lineHeight:1, zIndex:1, transition:"none", userSelect:"none",
                      ...(piece.color==="w" ? WHITE_STYLE : BLACK_STYLE) }}>
                      {PIECE_UNICODE[piece.type]}
                    </span>
                  )}
                  {file===0&&<span style={{ position:"absolute",top:2,left:3,fontSize:9,fontWeight:700,color:light?darkSq:lightSq,opacity:0.7,pointerEvents:"none" }}>{8-rank}</span>}
                  {rank===7&&<span style={{ position:"absolute",bottom:2,right:3,fontSize:9,fontWeight:700,color:light?darkSq:lightSq,opacity:0.7,pointerEvents:"none" }}>{FILES[file]}</span>}
                </div>
              );
            })}
          </div>
        ))}

        {/* Animated piece overlay */}
        {animPiece && (
          <span
            key={animPiece.key}
            style={{
              position:"absolute",
              fontSize:44,
              lineHeight:1,
              zIndex:20,
              pointerEvents:"none",
              userSelect:"none",
              ...(animPiece.piece.color==="w" ? WHITE_STYLE : BLACK_STYLE),
              left: animPiece.fromPx.x - 18,
              top:  animPiece.fromPx.y - 18,
              transform:"translate(0,0)",
              animation:`chessMove 180ms ease-in-out forwards`,
              "--dx": `${animPiece.toPx.x - animPiece.fromPx.x}px`,
              "--dy": `${animPiece.toPx.y - animPiece.fromPx.y}px`,
            }}>
            {PIECE_UNICODE[animPiece.piece.type]}
          </span>
        )}
      </div>

      {/* CSS for animation */}
      <style>{`
        @keyframes chessMove {
          from { transform: translate(0, 0); }
          to   { transform: translate(var(--dx), var(--dy)); }
        }
      `}</style>

      {/* Move history */}
      <div style={{ marginTop:12, width:"100%", maxWidth:SQUARE_SIZE*8+4, padding:"0 2px", boxSizing:"border-box" }}>
        <div style={{ fontSize:10, color:"#4a7060", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:5, fontWeight:700 }}>Moves</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, maxHeight:72, overflowY:"auto" }}>
          {history.reduce((acc,m,i)=>{ if(i%2===0)acc.push([m]); else acc[acc.length-1].push(m); return acc; },[]).map((pair,i)=>(
            <span key={i} style={{ fontSize:11, color:"#7a9e8e", background:"#1a1f1d", padding:"2px 8px", borderRadius:4 }}>
              {i+1}. {pair[0]}{pair[1]?` ${pair[1]}`:""}
            </span>
          ))}
        </div>
      </div>

      {/* Promotion modal */}
      {promotion && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:14, padding:28, display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
            <div style={{ fontSize:16, fontWeight:700 }}>Promote Pawn</div>
            <div style={{ display:"flex", gap:12 }}>
              {["q","r","b","n"].map(p=>(
                <button key={p} onClick={()=>executeMove(promotion.move, board, gameState, p)}
                  style={{ width:60, height:60, background:"#111312", border:"1px solid #1f2e28", borderRadius:10, fontSize:36, cursor:"pointer" }}>
                  {PIECE_UNICODE[p]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Confetti overlay */}
      {showConfetti && (
        <canvas ref={confettiRef} onClick={()=>setShowConfetti(false)}
          style={{ position:"fixed", inset:0, zIndex:999, pointerEvents:"auto", cursor:"pointer" }}/>
      )}
    </div>
  );
}
