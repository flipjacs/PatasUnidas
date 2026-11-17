<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AnimalPhotoResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'url' => $request->routeIs('public.animais.*')
                ? route('public.animais.fotos.arquivo', ['animal' => $this->animal_id, 'foto' => $this->id])
                : route('ong.animais.fotos.arquivo', ['animal' => $this->animal_id, 'foto' => $this->id]),
            'principal' => $this->principal,
        ];
    }
}
