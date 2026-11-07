import { La_Belle_Aurore, Nothing_You_Could_Do } from 'next/font/google';

/** The caption's hand on a Christmas card: the one in the October 30 drawing the founder liked. */
export const cardHand = Nothing_You_Could_Do({ weight: '400', subsets: ['latin'], display: 'swap' });

/** The note's pen on the card on the table (launch key card_table). Only that card loads it. */
export const cardPen = La_Belle_Aurore({ weight: '400', subsets: ['latin'], display: 'swap', preload: false });
