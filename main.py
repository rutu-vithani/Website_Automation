"""
main.py
Single entry point for the whole website-automation pipeline.
Just run this file directly — it will ask you what website you want,
then run CEO -> Frontend -> Database -> Backend -> Testing -> (GitHub y/n)
all in one go.

Run:
    python main.py
"""
from orchestrator import run_pipeline


def main():
    print("=" * 60)
    print(" Website Automation Agents")
    print("=" * 60)
    print("\nDescribe the website you want:\n")

    user_request = input("> ").strip()

    while not user_request:
        print("Request can't be empty, please try again.")
        user_request = input("> ").strip()

    run_pipeline(user_request)


if __name__ == "__main__":
    main()
