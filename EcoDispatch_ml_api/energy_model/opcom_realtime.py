import requests
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_day_ahead_prices():
    fallback_prices = {
        0: 0.35, 1: 0.32, 2: 0.30, 3: 0.30, 4: 0.32, 5: 0.38,
        6: 0.55, 7: 0.85, 8: 1.10, 9: 0.95, 10: 0.70, 11: 0.45,
        12: 0.25, 13: 0.15, 14: 0.10, 15: 0.20, 16: 0.45, 17: 0.90,
        18: 1.35, 19: 1.50, 20: 1.45, 21: 1.10, 22: 0.75, 23: 0.45
    }

    try:
        url = "https://www.opcom.ro/acasa/ro"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7'
        }

        response = requests.get(url, headers=headers, timeout=10, verify=False)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        base_row = next(
            (
                row for row in soup.find_all('tr')
                if row.find(['th', 'td'])
                and row.find(['th', 'td']).get_text(strip=True).lower() == 'ropex_dam_base'
            ),
            None,
        )
        if base_row is None:
            raise ValueError("ROPEX_DAM_Base row wasn't found.")

        cells = base_row.find_all(['th', 'td'])
        label_index = next(
            index for index, cell in enumerate(cells)
            if cell.get_text(strip=True).lower() == 'ropex_dam_base'
        )
        interval_prices = []
        for cell in cells[label_index + 1:]:
            price_str = cell.get_text(strip=True).replace('.', '').replace(',', '.')
            try:
                interval_prices.append(float(price_str))
            except ValueError:
                continue

        # OPCOM includes the daily aggregate before the 24/48/96 delivery intervals
        if len(interval_prices) in (25, 49, 97):
            interval_prices = interval_prices[1:]

        if len(interval_prices) not in (24, 48, 96):
            raise ValueError(
                f"Unexpected number of OPCOM intervals: {len(interval_prices)}"
            )

        intervals_per_hour = len(interval_prices) // 24
        return {
            hour: round(
                sum(interval_prices[hour * intervals_per_hour:(hour + 1) * intervals_per_hour])
                / intervals_per_hour / 1000.0,
                3,
            )
            for hour in range(24)
        }

    except Exception as e:
        print(f"[OPCOM Scraper] Error: {e}. Automatic fallback to the default profile.")
        return fallback_prices

if __name__ == "__main__":
    prices = get_day_ahead_prices()
    print("Prices (RON/kWh):")
    for hour, price in prices.items():
        print(f"Hour {hour:02d}:00 -> {price} RON")