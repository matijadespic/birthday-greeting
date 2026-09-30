/**
 * All editable names, messages, and local media paths live in this file.
 * Replace [PLACEHOLDER] text before sharing. Leave a media path as "" to
 * show a designed fallback instead of a broken image or video.
 *
 * Media files belong in /public/media/ and are referenced as "/media/filename".
 */

export const content = {
  recipientName: '[PLACEHOLDER: recipient name]',
  senderName: '[PLACEHOLDER: sender name]',
  occasionLabel: '[PLACEHOLDER: occasion]',
  documentTitle: '[PLACEHOLDER: page title]',

  nav: {
    back: 'Back',
    continue: 'Continue',
    begin: 'Open this, my love ✨',
    progressLabel: 'Greeting progress',
  },

  media: {
    fireworksVideo: '/media/firework.mp4',
    worryVideo: '/media/leave-worries.mp4',
    cocktailShaking: '/media/cocktail-shaking.jpeg',
    cocktailPouring: '/media/cocktail-pouring.jpeg',
    cocktailServing: '/media/cocktail-serving.jpeg',
    cocktailBridgeVideo: '/media/a-few-moments-later.mp4',
    /* Ambient bed under intro → worries → bar (extracted from septembar.mp4). */
    septembarMusic: '/media/septembar.m4a',
  },

  ambient: {
    /* Under fireworks + early scenes — keep room for firework SFX. */
    introVolume: 0.55,
    /* Quieter under the bartender scene. */
    barVolume: 0.22,
    /* Closing credits typewriter bed. */
    creditsVolume: 0.8,
    /* Fade out length when “a few moments later” starts. */
    bridgeFadeMs: 1600,
  },

  scenes: {
    fireworksIntro: {
      openLabel: 'Open this, my love ✨',
      keepGoingLabel: 'Keep going',
      skipLabel: 'Skip',
      tapForSoundLabel: 'Tap for sound',
      /* Fireworks clip level so Septembar can still be heard underneath. */
      videoVolume: 0.78,
      fallbackMessage: 'The sky is still yours tonight.',
      /* Milliseconds after play (or fallback) before the first overlay line. */
      startDelayMs: 900,
      /* How long each line stays on screen before the next fade. */
      holdMs: 4200,
      /* Pause between one line leaving and the next arriving. */
      gapMs: 450,
      fadeMs: 800,
      /* How early before the clip ends the Keep going button fades in. */
      buttonLeadMs: 2800,
      lines: [
        'Remember this moment?',
        'It’s time to celebrate again.',
        'But tonight, we’re celebrating you.',
        'Happy birthday,\nmi amor ❤️',
      ],
    },
    leaveWorries: {
      keepGoingLabel: 'Keep going',
      releaseLabel: 'Let them go',
      slideHint: 'Slide to make you smile',
      smileReveal: 'Olee — that’s it. Now we can grab a drink and celebrate.',
      /* How far the thumb must travel (0–1) to finish the clip and release. */
      completeAt: 0.92,
      /* Milliseconds before the first line after the scene settles. */
      startDelayMs: 700,
      /* How long each line stays before the next fade. */
      holdMs: 3200,
      /* Pause between one line leaving and the next arriving. */
      gapMs: 400,
      fadeMs: 700,
      lines: [
        'Some days are harder than they should be.',
        'This year, let’s trade more of them for smiles.',
      ],
    },
    cocktail: {
      stages: {
        shaking: {
          image: 'cocktailShaking',
          alt: 'The bartender shaking your birthday cocktail.',
          prompt:
            'Hey, sweetie! I heard it’s your birthday. Let me spoil you a little… How about a Porn Star Martini? 🍸',
          yesLabel: 'Yes, please! 🍸',
          noLabel: 'No, thanks…',
          noRevealLabel: 'Actually… yes! 😏',
          choicesLabel: 'Choose a reply',
        },
        pouring: {
          image: 'cocktailPouring',
          alt: 'The bartender pouring the cocktail into the glass.',
          prompt: 'Excellent choice, birthday girl. Coming right up!',
          continueLabel: 'Ready when you are 🍸',
        },
        serving: {
          image: 'cocktailServing',
          alt: 'The bartender offering the cocktail toward you.',
          prompt:
            'Here you go, sweetie. A little passion, a little sparkle — just for you. Cheers! 🥂',
          cheersLabel: 'Cheers! 🥂',
        },
      },
      /* Short interstitial after Cheers before the next scene. */
      bridgeFallbackMs: 2800,
    },
    singAndDance: {
      videoSrc: '/media/singing-or-dancing.mp4',
      /* Audio extracted from levelup.mp4 — overlays the dance clip. */
      musicSrc: '/media/level-up.m4a',
      placeholderLabel: 'A clip of you singing or dancing.',
      /* Milliseconds before the first line after the clip starts. */
      startDelayMs: 900,
      /* How long each line stays before the next fade. */
      holdMs: 3800,
      /* Pause between one line leaving and the next arriving. */
      gapMs: 450,
      fadeMs: 700,
      /* How early before the clip ends Level Up fades out so her laugh comes through. */
      musicFadeMs: 5500,
      /* Final black-screen typewriter after the clip (finale only). */
      closingMessage: 'To je moja žena!\nCumpleaños feliz,\nvolim te mucho ❤️',
      closingDelayMs: 700,
      typeCharMs: 55,
      lines: [
        'Yesss… that’s what I want.',
        'Be yourself — sing, dance, take up the whole room.',
        'Make me laugh. Cheer me up. Just like this.',
        'I love you… exactly this delightfully silly.',
        'Ok, that was maybe too nasty — don’t show my wishes to your family.',
      ],
    },
  },
}
