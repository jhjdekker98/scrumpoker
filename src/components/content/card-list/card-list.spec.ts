import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CardList } from './card-list';

// Helper to create a DOM root for each test
function createRoot(): HTMLElement {
    const root = document.createElement('div');
    document.body.appendChild(root);
    return root;
}

describe('CardList', () => {
    let root: HTMLElement;

    beforeEach(() => {
        document.body.innerHTML = '';
        root = createRoot();
    });

    it('renders default cards when no cards are provided', async () => {
        const cardList = new CardList(root);
        await cardList.mount();

        expect(cardList.cardCount()).to.be.greaterThan(0);
    });

    it('renders provided cards', async () => {
        const cards = ['A', 'B', 'C'];
        const cardList = new CardList(root, cards);
        await cardList.mount();

        // +1 because of add card
        expect(cardList.cardCount()).to.equal(cards.length + 1);
    });

    it('creates a new card', async () => {
        const cardList = new CardList(root, ['1', '2'], { modify: false, add: false });
        await cardList.mount();

        const initialCount = cardList.cardCount();
        cardList.createNewCard('X');

        expect(cardList.cardCount()).to.equal(initialCount + 1);
    });

    it('modifies a card by index', async () => {
        const cardList = new CardList(root, ['1', '2'], { modify: false, add: false });
        await cardList.mount();

        cardList.modifyCard(0, '99');

        const firstCardText = root.querySelector('.card h1')!.textContent;
        expect(firstCardText).to.equal('99');
    });

    it('removes a card by index', async () => {
        const cardList = new CardList(root, ['1', '2'], { modify: false, add: false });
        await cardList.mount();

        cardList.removeCard(0);

        expect(cardList.cardCount()).to.equal(1);
    });

    it('throws when modifying non-existent card', async () => {
        const cardList = new CardList(root, ['1'], { modify: false, add: false });
        await cardList.mount();

        expect(() => cardList.modifyCard(5, 'X')).to.throw();
    });

    it('throws when removing non-existent card', async () => {
        const cardList = new CardList(root, ['1'], { modify: false, add: false });
        await cardList.mount();

        expect(() => cardList.removeCard(5)).to.throw();
    });

    it('highlights card by index', async () => {
        const cardList = new CardList(root, ['1', '2'], { modify: false, add: false });
        await cardList.mount();

        cardList.highlightCardByIndex(0, CardList.HIGHLIGHT.OK);

        const card = root.querySelectorAll('.card')[0];
        expect(card.getAttribute('highlight')).to.equal(CardList.HIGHLIGHT.OK);
    });

    it('highlights card by value', async () => {
        const cardList = new CardList(root, ['1', '2'], { modify: false, add: false });
        await cardList.mount();

        cardList.highlightCardByValue('2', CardList.HIGHLIGHT.OK);

        const cards = Array.from(root.querySelectorAll('.card'));
        const target = cards.find(c => c.querySelector('h1').textContent === '2');

        expect(target!.getAttribute('highlight')).to.equal(CardList.HIGHLIGHT.OK);
    });

    it('calls onSelect when clicking card (non-modify mode)', async () => {
        const cardList = new CardList(root, ['A'], { modify: false, add: false });
        await cardList.mount();

        let selected: string | null = null;
        cardList.setOnSelect((val) => {
            selected = val;
        });

        const card = root.querySelector('.card') as HTMLElement;
        card.click();

        expect(selected).to.equal('A');
    });

    it('throws if onSelect not set in non-modify mode', async () => {
        const cardList = new CardList(root, ['A'], { modify: false, add: false });
        await cardList.mount();

        const card = root.querySelector('.card') as HTMLElement;
        const errorPromise = new Promise<Error>((resolve) => {
            const handler = (event: ErrorEvent) => {
                resolve(event.error);
                event.preventDefault(); // suppress console noise
            };
            window.addEventListener('error', handler, { once: true });
        });
        card.click();
        const error = await errorPromise;

        expect(error.message).to.equal('Callback for CardList::onSelect not set');
    });

    it('sets cards inactive', async () => {
        const cardList = new CardList(root, ['1'], { modify: false, add: false });
        await cardList.mount();

        cardList.cardsInactive();

        const card = root.querySelector('.card') as HTMLElement;
        expect(card.style.pointerEvents).to.equal('none');
    });

    it('sets cards active again', async () => {
        const cardList = new CardList(root, ['1'], { modify: false, add: false });
        await cardList.mount();

        cardList.cardsInactive();
        cardList.cardsActive();

        const card = root.querySelector('.card') as HTMLElement;
        expect(card.style.pointerEvents).to.equal('auto');
    });
});
