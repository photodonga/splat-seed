/* Private-use image skin for SPLAT SEED.
   References existing game art in Leanny/splat3; no PNGs are bundled.
   Runtime falls back to original CSS graphics when a remote image is unavailable. */
(() => {
  'use strict';
  const COMMIT = '7280ff9cde8bb1c5dcef46c700c326471584d2e6';
  const ROOT = 'https://raw.githubusercontent.com/Leanny/splat3/' + COMMIT + '/images/';
  const source = path => ROOT + path.split('/').map(encodeURIComponent).join('/');
  const names = [
    ['시즌 황금 배너', 'catalog/IconNameplate_02.png'],
    ['시즌 은 칭호', 'catalog/IconNameplate_03.png'],
    ['기어 파워 조각 ×10', 'misc/SkillIconPiece_00^s.png'],
    ['100% 업 식권', 'food/CoinEXPIcon_02.png'],
    ['50% 업 식권', 'food/CoinEXPIcon_00.png'],
    ['파티 음식', 'food/IconShopParty_00.png'],
    ['카드 팩', 'catalog/IconCardPack_00.png'],
    ['음료 티켓', 'food/GearPowerTicketBase.png'],
    ['기어 파워 조각', 'misc/SkillIconPiece_00^s.png'],
    ['로커 스티커', 'zakka/Emi_Sti_Decoration_18.png'],
    ['로커 피규어', 'zakka/Fig_Arcadegame.png'],
    ['이모트', 'emote/BigJump00.png'],
    ['배너', 'catalog/IconNameplate_00.png'],
    ['칭호', 'catalog/IconNameplate_03.png'],
  ];
  const findReward = text => {
    const entry = names.find(([name]) => text.includes(name));
    return entry ? entry[1] : null;
  };
  const mode = () => document.getElementById('mFest')?.getAttribute('aria-pressed') === 'true' ? 'fest' : 'normal';
  const gradeOf = el => {
    for (let i = 0; i < 6; i++) if (el.classList.contains('g' + i)) return i;
    return null;
  };

  function setImage(img, path, owner, readyClass) {
    const url = source(path);
    if (img.dataset.assetUrl === url) {
      if (owner && img.complete && img.naturalWidth > 0) owner.classList.add(readyClass);
      return;
    }
    img.dataset.assetUrl = url;
    img.hidden = false;
    if (owner) owner.classList.remove(readyClass);
    img.addEventListener('load', () => {
      if (img.dataset.assetUrl === url && owner) owner.classList.add(readyClass);
    }, {once: true});
    img.addEventListener('error', () => {
      if (img.dataset.assetUrl === url) {
        img.hidden = true;
        if (owner) owner.classList.remove(readyClass);
      }
    }, {once: true});
    img.src = url;
  }

  function decorateCapsule(el) {
    const grade = gradeOf(el);
    if (grade === null) return;
    if (!el.classList.contains('art-capsule')) el.classList.add('art-capsule');
    let img = el.querySelector(':scope > img.original-art');
    if (!img) {
      img = document.createElement('img');
      img.className = 'original-art';
      img.alt = '';
      img.decoding = 'async';
      img.setAttribute('aria-hidden', 'true');
      el.appendChild(img);
    }
    setImage(img, 'capsules/CapsuleIcon_0' + grade + '.png', el, 'art-ready');
  }

  function makeReward(parent, path, className = 'reward-art') {
    if (!path) {
      parent.querySelector(':scope > img.reward-art')?.remove();
      return;
    }
    let img = parent.querySelector(':scope > img.reward-art');
    if (!img) {
      img = document.createElement('img');
      img.className = className;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.decoding = 'async';
      img.loading = 'lazy';
      parent.prepend(img);
    }
    setImage(img, path);
  }

  function decorateAll() {
    if (!document.body || !document.querySelector('.app')) return;
    document.body.classList.add('personal-original-art');
    document.body.classList.toggle('mode-fest', mode() === 'fest');

    document.querySelectorAll('.cap').forEach(decorateCapsule);
    document.querySelectorAll('.hist span > i[class*="g"]').forEach(decorateCapsule);

    document.querySelectorAll('.items button[data-item]').forEach(btn => {
      if (btn.dataset.item === '-1') return;
      makeReward(btn, findReward(btn.textContent.trim()));
    });
    document.querySelectorAll('#nextOpts button.opt').forEach(btn => {
      const text = btn.textContent.trim();
      const path = findReward(text);
      if (path) {
        let img = btn.querySelector(':scope > img.reward-art');
        if (!img) {
          img = document.createElement('img');
          img.className = 'reward-art';
          img.alt = '';
          img.setAttribute('aria-hidden', 'true');
          btn.querySelector('.cap')?.after(img);
        }
        if (img) setImage(img, path);
      }
    });

    // In the main prediction, show a representative reward icon next to the capsule.
    const tapName = document.getElementById('tapName');
    const tap = document.getElementById('tapBtn');
    if (tapName && tap) {
      const path = findReward(tapName.textContent);
      let reward = tap.querySelector(':scope > img.reward-art');
      if (!path) reward?.remove();
      else {
        if (!reward) {
          reward = document.createElement('img');
          reward.className = 'reward-art';
          reward.alt = '';
          reward.setAttribute('aria-hidden', 'true');
          tap.querySelector('#tapCap')?.after(reward);
        }
        if (reward) setImage(reward, path);
      }
    }

    if (!document.querySelector('.art-source')) {
      const info = document.createElement('p');
      info.className = 'art-source';
      info.innerHTML = '개인용 원본 게임 이미지 미리보기 · <a href="personal-game-art-gallery.html">이미지 목록</a> · ' +
        '<a href="https://github.com/Leanny/splat3/tree/main/images" target="_blank" rel="noopener noreferrer">출처: Leanny/splat3</a>' +
        '<br>이미지는 외부 서버에서 불러옵니다. 불러오지 못하면 기존 색상 표시를 사용합니다.';
      document.querySelector('.app').append(info);
    }
  }

  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      decorateAll();
    });
  };
  document.addEventListener('DOMContentLoaded', () => {
    decorateAll();
    const root = document.querySelector('.app');
    if (root) {
      const observer = new MutationObserver(schedule);
      observer.observe(root, {childList:true, subtree:true, attributes:true, attributeFilter:['class', 'aria-pressed']});
    }
  }, {once:true});
})();
