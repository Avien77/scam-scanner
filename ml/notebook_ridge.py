"""
Ridge regression helpers (same structure as ScamDetector.ipynb / ML class).
Used with TF-IDF document features for spam vs. ham classification.
"""
import numpy as np


def add_bias_column(X):
    ones = np.ones((X.shape[0], 1))
    return np.hstack((ones, X))


def standardize_train_val(X_train, X_val):
    mean = np.mean(X_train, axis=0)
    std = np.std(X_train, axis=0)
    std[std == 0] = 1
    X_train_scaled = (X_train - mean) / std
    X_val_scaled = (X_val - mean) / std
    return X_train_scaled, X_val_scaled


def ridge_fit(X, y, lam):
    n_features = X.shape[1]
    I = np.eye(n_features)
    I[0, 0] = 0
    a = X.T @ X + lam * I
    b = X.T @ y
    try:
        w = np.linalg.solve(a, b)
    except np.linalg.LinAlgError:
        w = np.linalg.pinv(a) @ b
    return w


def predict(X, w):
    return X @ w


def mse(y_true, y_pred):
    return np.mean((y_true - y_pred) ** 2)


def create_folds(X, y, k=5, seed=42):
    np.random.seed(seed)
    indices = np.arange(len(X))
    np.random.shuffle(indices)
    X_shuffled = X[indices]
    y_shuffled = y[indices]
    X_folds = np.array_split(X_shuffled, k)
    y_folds = np.array_split(y_shuffled, k)
    return X_folds, y_folds


def cross_validate_ridge(X, y, lam, k=5):
    X_folds, y_folds = create_folds(X, y, k=k)
    errors = []
    for i in range(k):
        X_val = X_folds[i]
        y_val = y_folds[i]
        X_train = np.vstack([X_folds[j] for j in range(k) if j != i])
        y_train = np.hstack([y_folds[j] for j in range(k) if j != i])
        X_train_scaled, X_val_scaled = standardize_train_val(X_train, X_val)
        X_train_scaled = add_bias_column(X_train_scaled)
        X_val_scaled = add_bias_column(X_val_scaled)
        w = ridge_fit(X_train_scaled, y_train, lam)
        y_pred = predict(X_val_scaled, w)
        errors.append(mse(y_val, y_pred))
    return np.mean(errors)


def grid_search_ridge(X, y, lambda_values, k=5):
    best_lambda = None
    best_score = float("inf")
    results = []
    for lam in lambda_values:
        avg_mse = cross_validate_ridge(X, y, lam, k=k)
        results.append((lam, avg_mse))
        print(f"Lambda = {lam}, Average CV MSE = {avg_mse:.4f}")
        if avg_mse < best_score:
            best_score = avg_mse
            best_lambda = lam
    return best_lambda, best_score, results
