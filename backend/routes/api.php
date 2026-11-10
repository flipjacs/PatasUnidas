<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UsuarioController;
use App\Http\Middleware\EnsureActiveUser;
use Illuminate\Support\Facades\Route;

Route::post('/usuarios/cadastro', [UsuarioController::class, 'publico']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::middleware(['auth:web', EnsureActiveUser::class])->group(function (): void {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/usuarios/internos', [UsuarioController::class, 'interno']);
});
