"use client";

import { useEffect } from "react";

const siteMarkup = String.raw`
  <div class="page-glow glow-one"></div><div class="page-glow glow-two"></div>
  <header class="site-header"><a class="wordmark" href="#top">JAYDEN <span>ZHENG</span></a><nav aria-label="Primary navigation"><a href="#about">About</a><a href="#spider">Spider</a><a href="#life">Life</a></nav><a class="header-link" href="#spider">Hear the story <span>↓</span></a></header>
  <main id="top">
    <section class="hero">
      <div class="hero-copy"><p class="eyebrow">MUSICIAN · RUNNER · CREATOR</p><h1>Hi, I’m<br><em>Jayden.</em></h1><p class="hero-intro">I play violin, chase ideas, and am composing a piece called <i>Spider</i> — a violin and piano adventure that scurries, skitters, and surprises.</p><div class="hero-actions"><a class="button button-dark" href="#spider">Meet Spider <span>↘</span></a><a class="text-link" href="#about">A little about me <span>→</span></a></div></div>
      <div class="hero-art" aria-label="An abstract animated spider and musical notes"><div class="web web-a"></div><div class="web web-b"></div><div class="web web-c"></div><span class="note note-a">♪</span><span class="note note-b">♩</span><span class="note note-c">♫</span><div class="spider"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><b></b><span></span></div><p class="art-word">SPIDER</p><img class="portrait" src="assets/jayden-portrait.png" alt="Jayden Zheng wearing glasses"><div class="mini-card"><span>IN THE STUDIO</span><b>VIOLIN<br>+ PIANO</b><small>A STORY IN EIGHT LEGS</small></div></div>
    </section>
    <section class="about section" id="about"><p class="eyebrow">01 / HELLO</p><div class="about-grid"><h2>A little bit<br>of <em>everything.</em></h2><div><p class="large-copy">My name is Jayden Zheng. I love making things, moving fast, and finding the rhythm in whatever I’m doing.</p><p class="body-copy">When I’m not playing violin, you’ll probably find me swimming, running, playing games, or working on my next musical idea.</p></div></div><div class="interest-row"><article><span>01</span><b>♩</b><p>Playing<br>violin</p></article><article><span>02</span><b>⌇</b><p>Swimming<br>laps</p></article><article><span>03</span><b>↗</b><p>Running<br>outside</p></article><article><span>04</span><b>✦</b><p>Playing<br>games</p></article></div></section>
    <section class="spider-feature" id="spider"><div class="spider-stage" aria-hidden="true"><div class="stage-web"></div><div class="stage-line line-one"></div><div class="stage-line line-two"></div><span class="stage-note n-one">♫</span><span class="stage-note n-two">♩</span><span class="stage-note n-three">♪</span><div class="stage-spider"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><b></b></div><p>08</p></div><div class="spider-copy"><p class="eyebrow">02 / NEW COMPOSITION</p><h2><em>Spider.</em></h2><p class="large-copy">A violin and piano piece that sounds like a spider scurrying around.</p><p class="body-copy">Quick footsteps, tiny pauses, sudden turns — I’m using violin and piano to imagine a little spider on an enormous adventure. It is playful, mysterious, and full of movement.</p><div class="sound-tags"><span>VIOLIN</span><span>PIANO</span><span>SCURRYING</span></div><a class="button button-light" href="mailto:hello@example.com?subject=Spider%20by%20Jayden">Ask about Spider <span>↗</span></a></div></section>
    <section class="life section" id="life"><p class="eyebrow">03 / THINGS I LIKE</p><h2>The things that keep<br>me <em>moving.</em></h2><p class="life-intro">Whether I’m in the water, out on a run, or exploring a game, these are the things that help me recharge, have fun, and find new ideas.</p><div class="life-grid"><article class="life-card swim"><span>01</span><div class="card-emoji">〰</div><h3>Swimming</h3><p>Cool water, long laps, clear head.</p></article><article class="life-card run"><span>02</span><div class="card-emoji">↗</div><h3>Running</h3><p>One more corner. One more kilometre.</p></article><article class="life-card games"><span>03</span><div class="card-emoji">✦</div><h3>Games</h3><p>Big worlds, clever puzzles, good fun.</p></article></div></section>
    <section class="listen section" aria-labelledby="listen-title">
      <p class="eyebrow">04 / LISTEN</p>
      <div class="listen-grid"><div><h2 id="listen-title">Listen to<br><em>Spider.</em></h2><p>Jayden’s original violin and piano composition — now with a cleaned recording and the score to explore.</p></div><div class="audio-card"><span>ORIGINAL RECORDING</span><strong>Spider</strong><small>VIOLIN + PIANO · CLEANED AUDIO</small><audio controls preload="metadata"><source src="assets/spider-aggressive-clean.mp3" type="audio/mpeg">Your browser does not support audio playback.</audio><a class="score-link" href="assets/spider-score.pdf" target="_blank" rel="noopener">Open the score <span>↗</span></a><p class="copyright">© 2026 Jayden Zheng. All rights reserved.</p></div></div>
    </section>
    <section class="closing"><p class="eyebrow">JAYDEN ZHENG / 2026</p><h2>Thanks for<br><em>stopping by.</em></h2><a class="button button-dark" href="#top">Back to the top <span>↑</span></a></section>
  </main>
  <footer><a class="wordmark" href="#top">JAYDEN <span>ZHENG</span></a><p>Made with music and curiosity.</p><a href="mailto:hello@example.com">Say hello ↗</a></footer>
`;

export default function Home() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/app.js";
    document.body.appendChild(script);
    return () => script.remove();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: siteMarkup }} />;
}
