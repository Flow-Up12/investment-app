import pkg_resources
import requests
import json

print("Current installed packages:")
for package in pkg_resources.working_set:
    if package.key == 'yfinance':
        print(f"{package.key}=={package.version}")

def get_pypi_latest_version(package_name):
    try:
        response = requests.get(f"https://pypi.org/pypi/{package_name}/json")
        if response.status_code == 200:
            data = response.json()
            return data["info"]["version"]
        else:
            return f"Error: HTTP {response.status_code}"
    except Exception as e:
        return f"Error: {str(e)}"

print(f"\nLatest yfinance version on PyPI: {get_pypi_latest_version('yfinance')}")

# Test a basic yfinance operation
print("\nTesting basic yfinance operation:")
try:
    import yfinance as yf
    print(f"yfinance version: {yf.__version__}")
    
    # Try to get Apple stock info
    print("Trying to fetch AAPL info...")
    ticker = yf.Ticker("AAPL")
    info = ticker.info
    if info:
        print(f"Successfully retrieved info for AAPL")
    else:
        print("Retrieved empty info for AAPL")
except Exception as e:
    print(f"Error testing yfinance: {str(e)}") 