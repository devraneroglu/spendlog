/**
 * Largest-Triangle-Three-Buckets (LTTB) Downsampling Algorithm
 * Binlerce veri noktasını anlamlı trend ve tepe/dip noktalarını koruyarak 
 * hedef nokta sayısına (threshold) indirger. X ekseni sıkışmasını ve tarayıcı kasmasını önler.
 */
export interface DataPoint {
  x: number; // Timestamp veya index
  y: number; // Değer
  [key: string]: any;
}

export function lttbDownsample<T extends DataPoint>(data: T[], threshold: number): T[] {
  if (threshold >= data.length || threshold === 0) {
    return data;
  }

  const sampled: T[] = [];
  const every = (data.length - 2) / (threshold - 2);

  let a = 0;
  sampled.push(data[a]);

  for (let i = 0; i < threshold - 2; i++) {
    let avgX = 0;
    let avgY = 0;
    let avgRangeStart = Math.floor((i + 1) * every) + 1;
    let avgRangeEnd = Math.floor((i + 2) * every) + 1;
    avgRangeEnd = avgRangeEnd < data.length ? avgRangeEnd : data.length;

    const avgRangeLength = avgRangeEnd - avgRangeStart;

    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += data[j].x;
      avgY += data[j].y;
    }

    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    let rangeOffs = Math.floor((i + 0) * every) + 1;
    let rangeTo = Math.floor((i + 1) * every) + 1;

    const pointAX = data[a].x;
    const pointAY = data[a].y;

    let maxArea = -1;
    let maxAreaPoint = data[rangeOffs];
    let nextA = rangeOffs;

    for (let j = rangeOffs; j < rangeTo; j++) {
      const area =
        Math.abs(
          (pointAX - avgX) * (data[j].y - pointAY) -
            (pointAX - data[j].x) * (avgY - pointAY)
        ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = data[j];
        nextA = j;
      }
    }

    sampled.push(maxAreaPoint);
    a = nextA;
  }

  sampled.push(data[data.length - 1]);
  return sampled;
}
