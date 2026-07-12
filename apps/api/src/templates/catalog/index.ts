/**
 * 20 tayyor shablon — brief Y3-EXTRA jadvalidan (kasb, murakkablik ★, narx).
 * Har biri umumiy modullardan yig'iladi; kamida bitta BASHORAT + bitta AVTONOM
 * modulga ega (investor-darajasidagi chuqurlik). 1-shablon (do'kon egasi) —
 * bayroqdor ★★★★★ (kamera fuziyasi + tugash bashorati + avto-buyurtma).
 *
 * Har shablon o'z faylida — kasb bo'yicha alohida topish/tahrirlash uchun.
 */
import { AgentTemplate } from '../types';
import { SHOP_OWNER } from './shop-owner';
import { AUTO_SERVICE } from './auto-service';
import { RESTAURANT } from './restaurant';
import { CONSTRUCTION } from './construction';
import { ATELIER } from './atelier';
import { BEAUTY_SALON } from './beauty-salon';
import { DOCTOR } from './doctor';
import { EDUCATION_CENTER } from './education-center';
import { REAL_ESTATE } from './real-estate';
import { DELIVERY } from './delivery';
import { FARMER } from './farmer';
import { PHARMACY } from './pharmacy';
import { LAWYER } from './lawyer';
import { ACCOUNTING } from './accounting';
import { EVENTS } from './events';
import { TAXI_FLEET } from './taxi-fleet';
import { ONLINE_SHOP } from './online-shop';
import { GYM } from './gym';
import { PHOTOGRAPHER } from './photographer';
import { HOTEL } from './hotel';

export const TEMPLATES: AgentTemplate[] = [
  SHOP_OWNER,
  AUTO_SERVICE,
  RESTAURANT,
  CONSTRUCTION,
  ATELIER,
  BEAUTY_SALON,
  DOCTOR,
  EDUCATION_CENTER,
  REAL_ESTATE,
  DELIVERY,
  FARMER,
  PHARMACY,
  LAWYER,
  ACCOUNTING,
  EVENTS,
  TAXI_FLEET,
  ONLINE_SHOP,
  GYM,
  PHOTOGRAPHER,
  HOTEL,
];
